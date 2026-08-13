import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, startOfDay } from 'date-fns';
import { db } from './mockSupabase';
import { Property, Outlet, MemberStatus, ReportRecipient } from '../types';
import { emailService } from './emailService';

export function resolveLogoUrl(
  outlet?: { logo_url?: string; name?: string } | null,
  property?: { logo_url?: string; name?: string } | null,
  settings?: { logo_url?: string } | null
): string {
  const candidates = [
    outlet?.logo_url,
    property?.logo_url,
    settings?.logo_url
  ];

  for (const rawUrl of candidates) {
    if (rawUrl && typeof rawUrl === 'string' && rawUrl.trim()) {
      const clean = rawUrl.trim();
      if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('data:image/')) {
        return clean;
      }
      if (typeof window !== 'undefined' && window.location?.origin) {
        return `${window.location.origin}${clean.startsWith('/') ? '' : '/'}${clean}`;
      }
      return clean;
    }
  }

  const displayName = outlet?.name || property?.name || 'TTH';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=0f172a&color=ffffff&size=200&format=png&bold=true`;
}

function safeFormatDate(dateVal: any, formatStr: string = 'dd MMM yyyy'): string {
  if (!dateVal) return 'N/A';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return format(d, formatStr);
  } catch {
    return String(dateVal);
  }
}

export const reportService = {
  async fetchRevenueData(propertyId: string, outletId: string | 'all', date: Date = new Date()) {
    const start = startOfDay(date);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);

    const isProperty = outletId === 'all';
    const scopeId = isProperty ? propertyId : outletId;

    const [members, sales, bookings, categories, mTypes] = await Promise.all([
      db.getMembers(scopeId, isProperty),
      db.getSales(scopeId, isProperty),
      db.getMassageBookings(scopeId, isProperty),
      db.getCategories(scopeId),
      db.getMembershipTypes(scopeId, isProperty)
    ]);

    const dailyRevenue: { category: string; amount: number; count: number }[] = [];

    // 1. Membership Enrollments (New joins on this date)
    const newJoins = members.filter(m => {
      const mStart = new Date(m.start_date);
      return mStart >= start && mStart <= end && m.status !== MemberStatus.TENTATIVE;
    });
    if (newJoins.length > 0) {
      dailyRevenue.push({
        category: 'Membership Enrollments',
        amount: newJoins.reduce((sum, m) => sum + (m.net_amount || 0), 0),
        count: newJoins.length
      });
    }

    // 2. Sales (Retail/POS)
    const dailySales = sales.filter(s => {
      const sDate = new Date(s.created_at);
      return sDate >= start && sDate <= end && s.status === 'completed';
    });
    if (dailySales.length > 0) {
      dailyRevenue.push({
        category: 'Retail & POS',
        amount: dailySales.reduce((sum, s) => sum + (s.net_amount || 0), 0),
        count: dailySales.length
      });
    }

    // 3. Bookings (Services/Treatments)
    const dailyBookings = bookings.filter(b => {
      const bDate = new Date(b.date);
      return bDate >= start && bDate <= end && b.status === 'completed';
    });
    if (dailyBookings.length > 0) {
      dailyRevenue.push({
        category: 'Treatment Services',
        amount: dailyBookings.reduce((sum, b) => sum + (Number(b.price) || 0), 0),
        count: dailyBookings.length
      });
    }

    return dailyRevenue;
  },

  async generateDailyRevenuePDF(property: Property, outlet: Outlet | 'all', date: Date = new Date()) {
    const doc = new jsPDF();
    const dateStr = format(date, 'dd MMM yyyy');
    const outletName = outlet === 'all' ? 'All Outlets (Consolidated)' : outlet.name;

    // Header
    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(property.name.toUpperCase(), 105, 20, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text(`Daily Revenue Intelligence: ${outletName}`, 105, 30, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`Report Date: ${dateStr}`, 105, 38, { align: 'center' });

    // Fetch Real Data & Currency
    const [revenueData, currencies, settings] = await Promise.all([
      this.fetchRevenueData(property.id, outlet === 'all' ? 'all' : outlet.id, date),
      db.getCurrencies(),
      db.getSettings()
    ]);

    const defaultCurrency = (settings && currencies.find(c => c.id === settings.currency_id)) || currencies.find(c => c.is_default) || currencies[0];
    const currencySymbol = defaultCurrency?.symbol || '';
    const currencyCode = defaultCurrency?.code || '';
    const totalRevenue = revenueData.reduce((sum, item) => sum + item.amount, 0);

    // Helper to handle currency formatting
    const formatCurrency = (val: number | undefined | null) => {
      const safeAmount = (val === null || val === undefined || isNaN(Number(val))) ? 0 : Number(val);
      const formatted = safeAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (/[^\x00-\xFF\u20AC]/.test(currencySymbol)) {
        if (currencyCode === 'QAR' || currencySymbol === 'ر.ق') {
          return `QR ${formatted}`;
        }
        return `${currencyCode || ''} ${formatted}`.trim();
      }
      return `${currencySymbol} ${formatted}`;
    };

    // Table
    const tableConfig = {
      startY: 50,
      head: [['Strategic Category', 'Volume', 'Net Revenue']],
      body: revenueData.map(item => [
        item.category,
        item.count.toString(),
        formatCurrency(item.amount)
      ]),
      foot: [['TOTAL PORTFOLIO YIELD', '', formatCurrency(totalRevenue)]],
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 5 }
    };

    try {
      const actualAutoTable = typeof autoTable === 'function' ? autoTable : ((autoTable as any).default || autoTable);
      if (typeof (doc as any).autoTable === 'function') {
        (doc as any).autoTable(tableConfig);
      } else if (typeof actualAutoTable === 'function') {
        actualAutoTable(doc, tableConfig);
      }
    } catch (tableErr) {
      console.error("autoTable call failed", tableErr);
    }

    const finalY = (doc as any).lastAutoTable?.finalY || 100;
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text('This report is generated automatically by the TTH Management System.', 105, finalY + 20, { align: 'center' });
    doc.text(`© ${new Date().getFullYear()} ${property.name}. All rights reserved.`, 105, finalY + 25, { align: 'center' });

    return doc;
  },

  async sendInstantAlert(type: 'member_freeze' | 'sale_void' | 'members_joined', data: any, forcedRecipient?: ReportRecipient) {
    try {
        const [recipients, settings, properties, outlets] = await Promise.all([
            db.getReportRecipients(),
            db.getSettings(),
            db.getProperties(),
            db.getOutlets()
        ]);

        const filteredRecipients = forcedRecipient ? [forcedRecipient] : recipients.filter(r => r.report_type === type);
        console.log(`[ReportService] Found ${filteredRecipients.length} potential recipients for ${type}`);

        const results = [];
        for (const recipient of filteredRecipients) {
            if (!forcedRecipient) {
                if (recipient.property_id && data.property_id && recipient.property_id !== data.property_id) {
                    console.log(`[ReportService] Skipping recipient ${recipient.email}: Property ID mismatch (${recipient.property_id} vs ${data.property_id})`);
                    continue;
                }
                if (recipient.outlet_id && recipient.outlet_id !== 'all' && data.outlet_id && recipient.outlet_id !== data.outlet_id) {
                    console.log(`[ReportService] Skipping recipient ${recipient.email}: Outlet ID mismatch (${recipient.outlet_id} vs ${data.outlet_id})`);
                    continue;
                }
            }

            const property = properties.find(p => p.id === (data.property_id || recipient.property_id)) || properties[0];
            const outlet = outlets.find(o => o.id === (data.outlet_id || recipient.outlet_id));
            
            const logoUrl = resolveLogoUrl(outlet, property, settings);
            
            let subject = '';
            let html = '';

            const baseStyles = `
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #334155; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
                .container { max-width: 600px; margin: 0 auto; padding: 40px 10px; }
                .card { background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border: 1px solid #e2e8f0; }
                .header { background-color: #ffffff; padding: 32px 40px 24px; text-align: center; border-bottom: 1px solid #f1f5f9; }
                .logo { max-width: 180px; max-height: 80px; margin-bottom: 16px; object-fit: contain; }
                .title { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0; text-transform: uppercase; letter-spacing: 0.05em; }
                .subtitle { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 6px; }
                .content { padding: 32px 40px; }
                .info-table { width: 100%; border-collapse: collapse; margin: 24px 0; }
                .info-row { border-bottom: 1px solid #f8fafc; }
                .info-row:last-child { border-bottom: none; }
                .info-label { padding: 12px 16px 12px 0; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; width: 40%; vertical-align: top; text-align: left; }
                .info-value { padding: 12px 0; font-size: 14px; font-weight: 600; color: #1e293b; text-align: left; }
                .footer { background-color: #f8fafc; padding: 24px 40px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
                .timestamp { font-size: 10px; font-style: italic; color: #cbd5e1; margin-top: 16px; display: block; }
                .badge { padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
            `;

            if (type === 'member_freeze') {
                subject = `⚠️ Member Freeze Alert: ${data.member_name || 'Member'} - ${property?.name || ''} (${outlet?.name || ''})`;
                html = `
                    <!DOCTYPE html>
                    <html>
                    <head><style>${baseStyles} .alert-banner { background-color: #fee2e2; color: #b91c1c; padding: 10px 20px; font-weight: 700; font-size: 12px; text-transform: uppercase; text-align: center; letter-spacing: 0.05em; } .guest-summary { text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px dashed #e2e8f0; } .guest-name { font-size: 22px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }</style></head>
                    <body style="background-color: #f1f5f9;">
                        <div class="container">
                            <div class="card">
                                <div class="header">
                                    <img src="${logoUrl}" width="180" style="max-width: 180px; max-height: 80px; margin-bottom: 16px; object-fit: contain; display: block; margin-left: auto; margin-right: auto;" alt="${property?.name || 'Logo'}" />
                                    <h1 class="title">${property?.name || 'Operational Alert'}</h1>
                                    <div class="subtitle">${outlet?.name || ''} &bull; Internal Intelligence Log</div>
                                </div>
                                <div class="alert-banner">⚠️ Membership Freeze Action Detected</div>
                                <div class="content">
                                    <div class="guest-summary">
                                        <div class="guest-name">${data.member_name || 'Member'}</div>
                                        <div style="font-size: 13px; color: #64748b;">Account Reference: #${data.membership_number || 'N/A'}</div>
                                    </div>
                                    <p style="font-size: 14px; color: #64748b; margin-bottom: 24px; text-align: center;">This automated dispatch confirms a manual membership freeze has been processed. Detailed audit logs are provided below.</p>
                                    <table class="info-table">
                                        <tr class="info-row"><td class="info-label">Property</td><td class="info-value">${property?.name || 'N/A'}</td></tr>
                                        <tr class="info-row"><td class="info-label">Facility</td><td class="info-value">${outlet?.name || 'N/A'}</td></tr>
                                        <tr class="info-row"><td class="info-label">Membership Tier</td><td class="info-value">${data.membership_tier || 'N/A'}</td></tr>
                                        <tr class="info-row"><td class="info-label">Contact Phone</td><td class="info-value">${data.phone || 'N/A'}</td></tr>
                                        <tr class="info-row"><td class="info-label">Freeze Period</td><td class="info-value">${safeFormatDate(data.start_date, 'dd MMM')} - ${safeFormatDate(data.end_date, 'dd MMM yyyy')}</td></tr>
                                        <tr class="info-row"><td class="info-label">Total Duration</td><td class="info-value">${data.total_days || 0} Days</td></tr>
                                        <tr class="info-row"><td class="info-label">Reason</td><td class="info-value">${data.reason || 'Not specified'}</td></tr>
                                        <tr class="info-row"><td class="info-label">Authorized By</td><td class="info-value">${data.staff_name || 'System'}</td></tr>
                                    </table>
                                    <span class="timestamp">Audit recorded at: ${safeFormatDate(new Date(), 'HH:mm:ss dd/MM/yyyy')}</span>
                                </div>
                                <div class="footer">${property?.name || ''} &bull; Internal Intelligence Dispatch</div>
                            </div>
                        </div>
                    </body>
                    </html>
                `;
            } else if (type === 'sale_void') {
                const receiptId = data.receipt_no || data.receipt_number || 'N/A';
                subject = `❌ Transaction Void Alert: Sale #${receiptId} - ${property?.name || ''} (${outlet?.name || ''})`;
                html = `
                    <!DOCTYPE html>
                    <html>
                    <head><style>${baseStyles} .alert-banner { background-color: #fee2e2; color: #b91c1c; padding: 10px 20px; font-weight: 700; font-size: 12px; text-transform: uppercase; text-align: center; letter-spacing: 0.05em; } .summary-box { background-color: #f8fafc; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px; border: 1px solid #f1f5f9; } .summary-value { font-size: 26px; font-weight: 800; color: #ef4444; }</style></head>
                    <body style="background-color: #f8fafc;">
                        <div class="container">
                            <div class="card">
                                <div class="header">
                                    <img src="${logoUrl}" width="180" style="max-width: 180px; max-height: 80px; margin-bottom: 16px; object-fit: contain; display: block; margin-left: auto; margin-right: auto;" alt="${property?.name || 'Logo'}" />
                                    <h1 class="title">${property?.name || 'Financial Alert'}</h1>
                                    <div class="subtitle">${outlet?.name || ''} &bull; Internal Audit Log</div>
                                </div>
                                <div class="alert-banner">❌ Transaction Void Action Detected</div>
                                <div class="content">
                                    <div class="summary-box">
                                        <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.05em;">Voided Portfolio Value</div>
                                        <div class="summary-value">${data.currency || 'QAR'} ${data.amount || 0}</div>
                                    </div>
                                    <table class="info-table">
                                        <tr class="info-row"><td class="info-label">Property</td><td class="info-value">${property?.name || 'N/A'}</td></tr>
                                        <tr class="info-row"><td class="info-label">Facility</td><td class="info-value">${outlet?.name || 'N/A'}</td></tr>
                                        <tr class="info-row"><td class="info-label">Receipt Reference</td><td class="info-value">#${receiptId}</td></tr>
                                        <tr class="info-row"><td class="info-label">Customer Profile</td><td class="info-value">${data.guest_name || 'Walk-in Guest'}</td></tr>
                                        <tr class="info-row"><td class="info-label">Void Justification</td><td class="info-value">${data.void_reason || 'Not specified'}</td></tr>
                                        <tr class="info-row"><td class="info-label">Authorized By</td><td class="info-value">${data.staff_name || 'System'}</td></tr>
                                    </table>
                                    <span class="timestamp">Audit recorded at: ${safeFormatDate(new Date(), 'HH:mm:ss dd/MM/yyyy')}</span>
                                </div>
                                <div class="footer">${property?.name || ''} &bull; Internal Intelligence Dispatch</div>
                            </div>
                        </div>
                    </body>
                    </html>
                `;
            } else if (type === 'members_joined') {
                subject = `🎉 New Enrollment: ${data.member_name || 'New Member'} - ${property?.name || ''} (${outlet?.name || ''})`;
                html = `
                    <!DOCTYPE html>
                    <html>
                    <head><style>${baseStyles} .success-banner { background-color: #dcfce7; color: #166534; padding: 10px 20px; font-weight: 700; font-size: 12px; text-transform: uppercase; text-align: center; letter-spacing: 0.05em; } .welcome-box { text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px dashed #dcfce7; } .welcome-name { font-size: 22px; font-weight: 800; color: #065f46; margin-bottom: 4px; }</style></head>
                    <body style="background-color: #f0fdf4;">
                        <div class="container">
                            <div class="card">
                                <div class="header">
                                    <img src="${logoUrl}" width="180" style="max-width: 180px; max-height: 80px; margin-bottom: 16px; object-fit: contain; display: block; margin-left: auto; margin-right: auto;" alt="${property?.name || 'Logo'}" />
                                    <h1 class="title">${property?.name || 'Growth Update'}</h1>
                                    <div class="subtitle">${outlet?.name || ''} &bull; Membership Acquisition Successful</div>
                                </div>
                                <div class="success-banner">🎉 New Member Enrollment Verified</div>
                                <div class="content">
                                    <div class="welcome-box">
                                        <div class="welcome-name">${data.member_name || 'New Member'}</div>
                                        <div style="font-size: 13px; color: #059669; font-weight: 600;">Strategic Relationship Established</div>
                                    </div>
                                    <table class="info-table">
                                        <tr class="info-row"><td class="info-label">Property</td><td class="info-value">${property?.name || 'N/A'}</td></tr>
                                        <tr class="info-row"><td class="info-label">Facility</td><td class="info-value">${outlet?.name || 'N/A'}</td></tr>
                                        <tr class="info-row"><td class="info-label">Membership Tier</td><td class="info-value">${data.category_name || 'N/A'}</td></tr>
                                        <tr class="info-row"><td class="info-label">Strategic Investment</td><td class="info-value">${data.currency || 'QAR'} ${data.amount || 0}</td></tr>
                                        <tr class="info-row"><td class="info-label">Sales Representative</td><td class="info-value">${data.staff_name || 'System'}</td></tr>
                                    </table>
                                    <span class="timestamp">Audit recorded at: ${safeFormatDate(new Date(), 'HH:mm:ss dd/MM/yyyy')}</span>
                                </div>
                                <div class="footer">${property?.name || ''} &bull; Internal Intelligence Dispatch</div>
                            </div>
                        </div>
                    </body>
                    </html>
                `;
            }

            if (subject && html) {
                const result = await emailService.sendEmail(
                    recipient.email,
                    subject,
                    html
                );
                results.push({ email: recipient.email, ...result });
            }
        }
        return { success: results.length > 0 ? results.every(r => r.success) : false, results };
    } catch (e) {
        console.error("Instant alert dispatch failed", e);
        return { success: false, error: e };
    }
  },

  async generateEmailTemplate(property: Property, outlet: Outlet | 'all', date: Date = new Date()) {
    const dateStr = format(date, 'dd MMM yyyy');
    const outletName = outlet === 'all' ? 'All Outlets (Consolidated)' : outlet.name;
    
    const [revenueData, currencies, settings] = await Promise.all([
      this.fetchRevenueData(property.id, outlet === 'all' ? 'all' : outlet.id, date),
      db.getCurrencies(),
      db.getSettings()
    ]);

    const logoUrl = resolveLogoUrl(outlet === 'all' ? null : outlet, property, settings);
    const defaultCurrency = (settings && currencies.find(c => c.id === settings.currency_id)) || currencies.find(c => c.is_default) || currencies[0];
    const currencySymbol = defaultCurrency?.symbol || '';
    const totalRevenue = revenueData.reduce((sum, item) => sum + item.amount, 0);
    const totalCount = revenueData.reduce((sum, item) => sum + item.count, 0);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #334155; margin: 0; padding: 0; background-color: #f1f5f9; }
          .container { max-width: 600px; margin: 0 auto; padding: 40px 10px; }
          .card { background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border: 1px solid #e2e8f0; }
          .header { background-color: #ffffff; padding: 32px 40px 24px; text-align: center; border-bottom: 1px solid #f1f5f9; }
          .logo { max-width: 180px; max-height: 80px; margin-bottom: 16px; object-fit: contain; }
          .title { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0; text-transform: uppercase; letter-spacing: 0.05em; }
          .subtitle { font-size: 11px; font-weight: 600; color: #6366f1; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 6px; }
          
          .content { padding: 32px 40px; }
          .intro { font-size: 14px; color: #64748b; margin-bottom: 32px; }
          
          .stat-grid { display: table; width: 100%; border-collapse: separate; border-spacing: 12px 0; margin: 24px -12px; }
          .stat-card { display: table-cell; background: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #f1f5f9; width: 50%; text-align: center; }
          .stat-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; }
          .stat-value { font-size: 24px; font-weight: 800; color: #0f172a; }
          
          .footer { background-color: #f8fafc; padding: 24px 40px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
          .btn { display: inline-block; background-color: #6366f1; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 24px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <img src="${logoUrl}" width="180" style="max-width: 180px; max-height: 80px; margin-bottom: 16px; object-fit: contain; display: block; margin-left: auto; margin-right: auto;" alt="${property.name}" />
              <h1 class="title">${property.name}</h1>
              <div class="subtitle">Daily Revenue Intelligence</div>
            </div>
            
            <div class="content">
              <div class="intro">
                <p style="margin-top: 0;">Greetings Administrator,</p>
                <p>The daily financial performance report for <strong>${outletName}</strong> is now ready for your review. This summary encapsulates all strategic revenue streams processed on <strong>${dateStr}</strong>.</p>
              </div>
              
              <div class="stat-grid">
                <div class="stat-card">
                  <div class="stat-label">Total Revenue</div>
                  <div class="stat-value">${currencySymbol} ${totalRevenue.toLocaleString()}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Transactions</div>
                  <div class="stat-value">${totalCount}</div>
                </div>
              </div>

              <p style="font-size: 13px; color: #64748b; line-height: 1.5;">A detailed PDF intelligence report is attached to this communication, providing a comprehensive breakdown of departmental yields and volume analysis.</p>
              
              <div style="text-align: center;">
                <a href="#" class="btn">Access Intelligence Dashboard</a>
              </div>
            </div>
            
            <div class="footer">
              This is an automated intelligence dispatch from the TTH Management System.<br/>
              © ${new Date().getFullYear()} ${property.name}. All rights reserved.
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }
};
