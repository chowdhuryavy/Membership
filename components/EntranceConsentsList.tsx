import React, { useState, useEffect } from 'react';
import { db } from '../services/mockSupabase';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { EntranceFeeConsent } from '../types';
import { getBilingualWaiverText } from '../lib/waiverHelper';
import { Search, Calendar, FileSignature, Download, Printer, Edit3, Trash2, AlertTriangle, X, History, BarChart3, LayoutGrid, Plus } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { EntranceFeeConsentModal } from './EntranceFeeConsentModal';
import { GuestEntranceHistoryModal } from './GuestEntranceHistoryModal';
import { EntranceFeeReports } from './EntranceFeeReports';
import toast from 'react-hot-toast';

export const EntranceConsentsList = ({ propertyId, outletId }: { propertyId?: string, outletId?: string }) => {
    const { currentProperty, currentOutlet, properties, outlets, settings, hasPermission } = useSettings();
    const { user } = useAuth();
    const [consents, setConsents] = useState<EntranceFeeConsent[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDate, setFilterDate] = useState<string>('');
    const [activeView, setActiveView] = useState<'registry' | 'history' | 'reports'>('registry');
    const [editingConsent, setEditingConsent] = useState<EntranceFeeConsent | null>(null);
    const [deletingConsent, setDeletingConsent] = useState<EntranceFeeConsent | null>(null);
    const [selectedGuestHistoryConsent, setSelectedGuestHistoryConsent] = useState<EntranceFeeConsent | null>(null);
    const [newConsentGuestData, setNewConsentGuestData] = useState<Partial<EntranceFeeConsent> | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const todayStr = new Date().toISOString().split('T')[0];

    const canEdit = true;
    const canDelete = true;

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

        const handleSync = () => {
            loadConsents();
        };

        window.addEventListener('entrance_consent_deleted', handleSync);
        window.addEventListener('booking_updated', handleSync);

        return () => {
            window.removeEventListener('entrance_consent_deleted', handleSync);
            window.removeEventListener('booking_updated', handleSync);
        };
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

    const todayConsents = consents.filter(c => c.date === todayStr);
    const archiveConsents = consents.filter(c => c.date !== todayStr);

    const baseConsents = filterDate 
        ? consents.filter(c => c.date === filterDate)
        : (activeView === 'registry' ? todayConsents : (activeView === 'history' ? archiveConsents : consents));

    const filtered = baseConsents.filter(c => 
        c.guest_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (c.qid_passport && c.qid_passport.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.room_number && c.room_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.phone && c.phone.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handlePrintReport = () => {
        if (filtered.length === 0) {
            toast.error('No data to print for the current selection.');
            return;
        }

        const reportDate = filterDate ? format(parseISO(filterDate), 'dd MMM yyyy') : (activeView === 'registry' ? 'Today (' + format(new Date(), 'dd MMM yyyy') + ')' : 'All Records');
        const title = `Entrance Fee Report - ${reportDate}`;
        
        const matchedProperty = currentProperty || properties?.[0];
        const propertyName = matchedProperty?.name || settings?.name || '';
        const logoUrl = matchedProperty?.logo_url || settings?.logo_url || '';

        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        
        const doc = iframe.contentWindow?.document;
        if (!doc) return;

        doc.open();
        doc.write(`
            <html>
                <head>
                    <title>${title}</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
                        body { font-family: 'Plus Jakarta Sans', sans-serif; padding: 30px; color: #0f172a; }
                        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 15px; margin-bottom: 20px; }
                        .logo { max-height: 50px; }
                        .title-section h1 { margin: 0; font-size: 18px; font-weight: 800; text-transform: uppercase; color: #059669; }
                        .title-section p { margin: 2px 0 0; font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                        th { background: #f8fafc; text-align: left; padding: 10px; font-size: 9px; font-weight: 800; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0; }
                        td { padding: 10px; font-size: 10px; border-bottom: 1px solid #f1f5f9; color: #334155; }
                        .footer { margin-top: 30px; font-size: 9px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 15px; }
                        .tag { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 8px; font-weight: 800; text-transform: uppercase; }
                        .tag-resident { background: #fff7ed; color: #c2410c; }
                        .tag-visitor { background: #f0fdf4; color: #15803d; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="title-section">
                            <h1>Entrance Registry Report</h1>
                            <p>${propertyName} • ${reportDate}</p>
                        </div>
                        ${logoUrl ? `<img src="${logoUrl}" class="logo" />` : ''}
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Guest Name</th>
                                <th>Type</th>
                                <th>Room/QID</th>
                                <th>Contact</th>
                                <th>Item/Access</th>
                                <th>Date</th>
                                <th>Time</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtered.map((c, idx) => `
                                <tr>
                                    <td>${idx + 1}</td>
                                    <td style="font-weight: 700;">${c.guest_name}</td>
                                    <td><span class="tag ${c.room_number || c.is_hotel_guest ? 'tag-resident' : 'tag-visitor'}">${c.room_number || c.is_hotel_guest ? 'Hotel Guest' : 'Visitor'}</span></td>
                                    <td>${c.room_number ? 'Room ' + c.room_number : (c.qid_passport || '-')}</td>
                                    <td>${c.phone || '-'}</td>
                                    <td>${c.item_name || '-'}</td>
                                    <td>${format(parseISO(c.date), 'dd/MM/yyyy')}</td>
                                    <td>${c.time || '-'}</td>
                                    <td>${c.guest_signature ? 'Signed' : 'No Sig'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <div class="footer">
                        Generated on ${format(new Date(), 'dd MMM yyyy, HH:mm')} by ${user?.name || 'System Administrator'} • Total Entries: ${filtered.length}
                    </div>
                    <script>
                        window.onload = () => { window.print(); };
                    </script>
                </body>
            </html>
        `);
        doc.close();

        setTimeout(() => {
            document.body.removeChild(iframe);
        }, 1000);
    };

    const isUnsplashDefault = (url?: string) => !url || url.includes('images.unsplash.com/photo-1540555700478-4be289fbecef');

    const handlePrint = (consent: EntranceFeeConsent) => {
        const title = `Entrance Fee Consent - ${consent.guest_name}`;
        
        // Resolve outlet and property details for this specific consent
        const matchedOutlet = outlets?.find(o => o.id === consent.outlet_id) || currentOutlet || outlets?.[0];
        const matchedProperty = properties?.find(p => p.id === matchedOutlet?.property_id) || currentProperty || properties?.[0];

        const propertyName = matchedProperty?.name || currentProperty?.name || settings?.name || '';
        const outletName = matchedOutlet?.name || currentOutlet?.name || '';

        const logoUrl = currentProperty?.logo_url || matchedProperty?.logo_url || matchedOutlet?.logo_url || settings?.logo_url || '';
        const address = matchedOutlet?.address?.trim() || matchedProperty?.address?.trim() || currentOutlet?.address?.trim() || settings?.address?.trim() || '';
        const phone = matchedOutlet?.phone?.trim() || matchedProperty?.phone?.trim() || currentOutlet?.phone?.trim() || settings?.phone?.trim() || '';

        const waiver = getBilingualWaiverText(outletName, propertyName);

        // Create a hidden iframe for printing
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        
        const doc = iframe.contentWindow?.document;
        if (!doc) return;

        doc.open();
        doc.write(`
            <html>
                <head>
                    <title>${title}</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
                        body { font-family: 'Plus Jakarta Sans', sans-serif; padding: 40px; color: #0f172a; max-width: 850px; margin: 0 auto; background: #ffffff; line-height: 1.5; }
                        .header-container { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 20px; }
                        .header-left { display: flex; align-items: center; gap: 16px; }
                        .header-logo { max-height: 60px; max-width: 180px; object-fit: contain; }
                        .header-brand { font-size: 18px; font-weight: 900; text-transform: uppercase; color: #0f172a; letter-spacing: -0.5px; line-height: 1.1; }
                        .header-outlet { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #059669; tracking: 1px; margin-top: 3px; }
                        .header-meta { font-size: 10px; color: #64748b; font-weight: 600; text-align: right; line-height: 1.4; }
                        .doc-title { color: #059669; font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
                        .subtitle { font-size: 10px; color: #64748b; font-weight: 800; text-transform: uppercase; margin-bottom: 20px; letter-spacing: 1.5px; }
                        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; background: #f8fafc; padding: 14px; border-radius: 12px; border: 1px solid #e2e8f0; }
                        .field { margin-bottom: 0px; }
                        .label { font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px; }
                        .value { font-size: 12px; font-weight: 700; color: #0f172a; }
                        .disclaimer-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 14px; margin-bottom: 16px; font-size: 10px; line-height: 1.5; color: #78350f; }
                        .disclaimer-title-en { font-weight: 900; text-transform: uppercase; color: #92400e; margin-bottom: 3px; font-size: 10px; }
                        .disclaimer-title-ar { font-weight: 900; color: #78350f; margin-bottom: 3px; font-size: 11px; font-family: system-ui, sans-serif; }
                        .waiver-container { background: #fafafa; border: 1px solid #e2e8f0; padding: 16px; border-radius: 12px; font-size: 10px; line-height: 1.55; color: #334155; margin-bottom: 25px; }
                        .waiver-head-en { font-weight: 900; text-transform: uppercase; color: #0f172a; font-size: 11px; margin-bottom: 6px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
                        .waiver-head-ar { font-weight: 900; color: #0f172a; font-size: 12px; margin-top: 12px; margin-bottom: 6px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; font-family: system-ui, sans-serif; text-align: right; }
                        .waiver-p { margin-bottom: 8px; }
                        .waiver-p-ar { margin-bottom: 8px; text-align: right; font-family: system-ui, sans-serif; font-size: 10.5px; }
                        .signature-section { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 20px; }
                        .signature-box { border-top: 2px solid #94a3b8; padding-top: 10px; width: 280px; }
                        .sig-img { max-width: 100%; max-height: 80px; margin-bottom: 6px; }
                        @page {
                            margin: 8mm;
                        }
                        @media print {
                            body { padding: 1.5cm; }
                            .header-container { margin-top: 0; }
                        }
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

                    <div class="doc-title">Entrance Fee Consent / إقرار رسوم الدخول</div>
                    <div class="subtitle">Guest Waiver & Liability Release Form / نموذج التنازل وإخلاء المسؤولية</div>
                    
                    <div class="grid">
                        <div class="field">
                            <div class="label">Guest Name / اسم الضيف</div>
                            <div class="value">${consent.guest_name} ${consent.room_number ? `<span style="font-size: 11px; color: #b45309; font-weight: 800;">(Room ${consent.room_number})</span>` : ''}</div>
                        </div>
                        <div class="field">
                            <div class="label">Date & Time / التاريخ والوقت</div>
                            <div class="value">${format(new Date(consent.date), 'dd MMM yyyy')} ${consent.time ? `• ${consent.time}` : ''}</div>
                        </div>
                        <div class="field">
                            <div class="label">Room / Guest Type / الغرفة - الفئة</div>
                            <div class="value">${consent.room_number ? `Room ${consent.room_number} (Hotel Resident)` : (consent.is_hotel_guest ? 'In-House Hotel Guest' : 'Day Pass Guest')}</div>
                        </div>
                        <div class="field">
                            <div class="label">QID / Passport / البطاقة - الجواز</div>
                            <div class="value">${consent.qid_passport || 'N/A'}</div>
                        </div>
                        <div class="field" style="grid-column: span 2;">
                            <div class="label">Contact / الاتصال</div>
                            <div class="value">${consent.phone || ''} ${consent.email ? '- ' + consent.email : ''}</div>
                        </div>
                    </div>

                    ${consent.item_name ? `
                    <div style="margin-bottom: 16px; background: #f1f5f9; padding: 10px 14px; border-radius: 8px;">
                        <div class="label">Access Type or Package / نوع الدخول أو الباقة</div>
                        <div class="value">${consent.item_name}</div>
                    </div>
                    ` : ''}

                    <div class="disclaimer-box">
                        <div class="disclaimer-title-en">IMPORTANT DISCLAIMER:</div>
                        <div class="waiver-p">${waiver.importantDisclaimerEn}</div>
                        <div dir="rtl" style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #fcd34d;">
                            <div class="disclaimer-title-ar">إخلاء مسؤولية هام:</div>
                            <div class="waiver-p-ar">${waiver.importantDisclaimerAr}</div>
                        </div>
                    </div>

                    <div class="waiver-container">
                        <div class="waiver-head-en">${waiver.waiverTitleEn} — ${waiver.waiverSubEn}</div>
                        <div class="waiver-p">${waiver.p1En}</div>
                        <div class="waiver-p">${waiver.p2En}</div>
                        <div class="waiver-p" style="font-weight: 600;">${waiver.p3En}</div>

                        <div dir="rtl" class="waiver-head-ar">${waiver.waiverTitleAr} — ${waiver.waiverSubAr}</div>
                        <div dir="rtl" class="waiver-p-ar">${waiver.p1Ar}</div>
                        <div dir="rtl" class="waiver-p-ar">${waiver.p2Ar}</div>
                        <div dir="rtl" class="waiver-p-ar" style="font-weight: 700;">${waiver.p3Ar}</div>
                    </div>

                    <div class="signature-section">
                        <div class="signature-box">
                            ${consent.guest_signature ? `<img src="${consent.guest_signature}" class="sig-img" alt="Signature" />` : '<div style="height: 70px;"></div>'}
                            <div class="label">Guest Signature / توقيع الضيف</div>
                            <div class="value">${consent.guest_name}</div>
                        </div>
                        <div style="text-align: right; font-size: 9px; color: #64748b; font-weight: 700; text-transform: uppercase; tracking: 0.5px;">
                            <div>Signed On: ${format(new Date(consent.created_at || consent.date), 'dd MMM yyyy, HH:mm')}</div>
                            <div>Exported on: ${format(new Date(), 'dd-MMM-yyyy HH:mm:ss')} ${user?.name ? `by ${user.name}` : ''}</div>
                            <div>Outlet: ${outletName}</div>
                        </div>
                    </div>
                    
                    <script>
                        window.onload = () => {
                            window.focus();
                            window.print();
                        };
                    </script>
                </body>
            </html>
        `);
        doc.close();

        // Clean up
        setTimeout(() => {
            document.body.removeChild(iframe);
        }, 1000);
    };

    if (loading) return <div className="p-8 text-center text-slate-400 font-bold text-xs animate-pulse">Loading consents...</div>;

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* View Mode Switcher Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                        onClick={() => setActiveView('registry')}
                        className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                            activeView === 'registry'
                                ? 'bg-white text-emerald-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <LayoutGrid className="w-4 h-4" />
                        Today's Registry ({todayConsents.length})
                    </button>
                    <button
                        onClick={() => setActiveView('history')}
                        className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                            activeView === 'history'
                                ? 'bg-white text-amber-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <History className="w-4 h-4" />
                        Archive History ({archiveConsents.length})
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
                        Reports
                    </button>
                </div>

                {activeView !== 'reports' && (
                    <div className="flex flex-1 flex-col sm:flex-row items-center gap-2 max-w-2xl w-full">
                        <div className="relative flex-1 w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Search by name, QID, phone..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full h-10 pl-10 pr-4 rounded-xl bg-slate-50 border-none text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-600 transition-all placeholder:text-slate-400"
                            />
                        </div>
                        <div className="relative w-full sm:w-44">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                                type="date" 
                                value={filterDate}
                                onChange={e => {
                                    setFilterDate(e.target.value);
                                    if (e.target.value) {
                                        setActiveView('history'); // Switch to history view if filtering by specific date
                                    }
                                }}
                                className="w-full h-10 pl-10 pr-4 rounded-xl bg-slate-50 border-none text-[10px] font-black text-slate-900 focus:ring-2 focus:ring-emerald-600 transition-all uppercase"
                            />
                            {filterDate && (
                                <button 
                                    onClick={() => setFilterDate('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-200 text-slate-400"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                        <button
                            onClick={handlePrintReport}
                            className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 transition-all shadow-md shadow-indigo-100 active:scale-95"
                            title="Print Date-wise Report"
                        >
                            <Printer className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest hidden lg:inline">Print Report</span>
                        </button>
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

            {/* Cards Grid Registry/History View */}
            {(activeView === 'registry' || activeView === 'history') && (
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
                                        <Calendar className="w-3 h-3 text-slate-400" /> {format(parseISO(c.date), 'dd MMM yyyy')} {c.time ? `• ${c.time}` : ''}
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
                                {(c.room_number || c.is_hotel_guest) && (
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="w-16 text-[9px] font-black text-slate-400 uppercase tracking-widest">Room No.</span>
                                        <span className="font-black text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
                                            {c.room_number ? `Room ${c.room_number}` : 'Hotel Guest'}
                                        </span>
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
                            {activeView === 'registry' ? (
                                <>
                                    <FileSignature className="w-12 h-12 text-slate-300 mb-4" />
                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-1">No Entries Today</h3>
                                    <p className="text-xs font-medium text-slate-500 max-w-sm">There are no entrance consents logged for today yet. Use the "New Consent Form" button to add one.</p>
                                </>
                            ) : (
                                <>
                                    <History className="w-12 h-12 text-slate-300 mb-4" />
                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-1">Archive is Empty</h3>
                                    <p className="text-xs font-medium text-slate-500 max-w-sm">No historical entrance consents were found matching your filters.</p>
                                </>
                            )}
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
                    key={`new-consent-${newConsentGuestData.guest_name || 'guest'}`}
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
                    key={`edit-consent-${editingConsent.id}`}
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
                            Are you sure you want to delete the entrance fee waiver consent for <strong className="text-slate-900">{deletingConsent.guest_name}</strong> dated <strong className="text-slate-900">{format(parseISO(deletingConsent.date), 'dd MMM yyyy')}</strong>? This action will remove the record permanently from Supabase.
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