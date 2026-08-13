import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, startOfDay } from 'date-fns';
import { db } from './mockSupabase';
import { Property, Outlet, MemberStatus, ReportRecipient } from '../types';
import { emailService } from './emailService';

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
      // Group by category if possible, or just aggregate
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

    // Logo Placeholder or actual logo if available
    if (property.logo_url) {
        try {
            // In a real app, you'd fetch and add the image
            // doc.addImage(property.logo_url, 'PNG', 10, 10, 30, 30);
        } catch (e) {}
    }

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
      // jsPDF default fonts only support WinAnsiEncoding (mostly Latin-1).
      // Symbols like 'ر.ق' (Qatari Riyal) will render as garbled text (e.g. þÕ.þ-).
      // We check if the currency symbol contains characters outside the safe range.
      // If it does, we fallback to the currency code (e.g. QAR) to ensure the PDF is readable.
      if (/[^\x00-\xFF\u20AC]/.test(currencySymbol)) {
        // Special case for Qatari Riyal which is common in this app
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
      } else {
        throw new Error("autoTable not found on doc or as standalone function");
      }
    } catch (tableErr) {
      console.error("autoTable call failed", tableErr);
      throw tableErr;
    }

    // Footer
    const finalY = (doc as any).lastAutoTable.finalY + 20;
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text('This report is generated automatically by the TTH Management System.', 105, finalY, { align: 'center' });
    doc.text(`© ${new Date().getFullYear()} ${property.name}. All rights reserved.`, 105, finalY + 5, { align: 'center' });

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
        if (filteredRecipients.length === 0) {
            console.log(`[ReportService] No recipients found for ${type}`);
            return { success: false, error: 'No recipients' };
        }

        const results = [];
        for (const recipient of filteredRecipients) {
            // Check scope if not forced
            if (!forcedRecipient) {
                if (recipient.property_id && data.property_id && recipient.property_id !== data.property_id) continue;
                if (recipient.outlet_id && recipient.outlet_id !== 'all' && data.outlet_id && recipient.outlet_id !== data.outlet_id) continue;
            }

            const property = properties.find(p => p.id === (data.property_id || recipient.property_id)) || properties[0];
            const outlet = outlets.find(o => o.id === (data.outlet_id || recipient.outlet_id));
            const logoUrl = property?.logo_url || settings?.logo_url || 'https://picsum.photos/seed/tth/200/200';
            
            let subject = '';
            let html = '';

            if (type === 'member_freeze') {
                subject = `⚠️ Member Freeze Alert: ${data.member_name} - ${property?.name || ''} (${outlet?.name || ''})`;
                html = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: 'Inter', -apple-system, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; }
                            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #fff1f2; }
                            .card { background: #ffffff; border-radius: 24px; padding: 40px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); border: 1px solid #fecaca; }
                            .header { text-align: center; margin-bottom: 32px; }
                            .logo { width: 64px; height: 64px; border-radius: 16px; margin-bottom: 16px; object-fit: cover; border: 2px solid #f1f5f9; }
                            .title { font-size: 20px; font-weight: 900; color: #9f1239; text-transform: uppercase; letter-spacing: -0.025em; margin: 0; }
                            .subtitle { font-size: 10px; font-weight: 700; color: #e11d48; text-transform: uppercase; letter-spacing: 0.2em; margin-top: 4px; }
                            .divider { height: 1px; background: #f1f5f9; margin: 24px 0; }
                            .content { font-size: 14px; color: #475569; }
                            .info-table { width: 100%; border-collapse: separate; border-spacing: 0 8px; margin: 20px 0; }
                            .info-label { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; width: 40%; }
                            .info-value { font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; }
                            .footer { text-align: center; margin-top: 32px; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 20px; }
                            .alert-banner { background: #fff1f2; color: #9f1239; padding: 12px; border-radius: 12px; text-align: center; font-weight: 800; font-size: 11px; text-transform: uppercase; margin-bottom: 24px; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="card">
                                <div class="header">
                                    <img src="${logoUrl}" class="logo" />
                                    <h1 class="title">${property?.name || 'Security Alert'}</h1>
                                    <div class="subtitle">${outlet?.name || ''} &bull; Operational Exception Logged</div>
                                </div>
                                
                                <div class="alert-banner">⚠️ Membership Frozen Action Detected</div>
                                <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-bottom: 8px; text-align: center;">Guest Detail: ${data.member_name}</div>
                                <div style="font-size: 12px; color: #64748b; margin-bottom: 24px; text-align: center;">#${data.membership_number}</div>

                                <div class="content">
                                    <p>The system has logged a manual membership freeze for the guest specified above. Please review the forensic details below.</p>
                                    
                                    <table class="info-table">
                                        <tr><td class="info-label">Property context</td><td class="info-value">${property?.name}</td></tr>
                                        <tr><td class="info-label">Facility context</td><td class="info-value">${outlet?.name}</td></tr>
                                        <tr><td class="info-label">Member Name</td><td class="info-value">${data.member_name}</td></tr>
                                        <tr><td class="info-label">Member ID</td><td class="info-value">#${data.membership_number}</td></tr>
                                        <tr><td class="info-label">Membership Tier</td><td class="info-value">${data.membership_tier || 'N/A'}</td></tr>
                                        <tr><td class="info-label">Contact Phone</td><td class="info-value">${data.phone || 'N/A'}</td></tr>
                                        <tr><td class="info-label">Freeze Period</td><td class="info-value">${format(new Date(data.start_date), 'dd MMM')} - ${format(new Date(data.end_date), 'dd MMM yyyy')}</td></tr>
                                        <tr><td class="info-label">Total Duration</td><td class="info-value">${data.total_days} Days</td></tr>
                                        <tr><td class="info-label">Reason Provided</td><td class="info-value">${data.reason || 'Not specified'}</td></tr>
                                        <tr><td class="info-label">Authorized By</td><td class="info-value">${data.staff_name}</td></tr>
                                    </table>

                                    <p style="font-size: 12px; font-style: italic; color: #94a3b8; margin-top: 24px;">
                                        Audit recorded at: ${format(new Date(), 'HH:mm:ss dd/MM/yyyy')}
                                    </p>
                                </div>
                                
                                <div class="footer">
                                    ${property?.name || ''} &bull; Internal Intelligence Dispatch
                                </div>
                            </div>
                        </div>
                    </body>
                    </html>
                `;
            } else if (type === 'sale_void') {
                const outlet = outlets.find(o => o.id === data.outlet_id);
                subject = `❌ Transaction Void Alert: Sale #${data.receipt_no} - ${property?.name || ''} (${outlet?.name || ''})`;
                html = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: 'Inter', -apple-system, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; }
                            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #f8fafc; }
                            .card { background: #ffffff; border-radius: 24px; padding: 40px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; }
                            .header { text-align: center; margin-bottom: 32px; }
                            .logo { width: 64px; height: 64px; border-radius: 16px; margin-bottom: 16px; object-fit: cover; border: 2px solid #f1f5f9; }
                            .title { font-size: 20px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: -0.025em; margin: 0; }
                            .subtitle { font-size: 10px; font-weight: 700; color: #ef4444; text-transform: uppercase; letter-spacing: 0.2em; margin-top: 4px; }
                            .divider { height: 1px; background: #f1f5f9; margin: 24px 0; }
                            .content { font-size: 14px; color: #475569; }
                            .info-table { width: 100%; border-collapse: separate; border-spacing: 0 8px; margin: 20px 0; }
                            .info-label { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; width: 40%; }
                            .info-value { font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; }
                            .footer { text-align: center; margin-top: 32px; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 20px; }
                            .void-banner { background: #fee2e2; color: #b91c1c; padding: 12px; border-radius: 12px; text-align: center; font-weight: 800; font-size: 11px; text-transform: uppercase; margin-bottom: 24px; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="card">
                                <div class="header">
                                    <img src="${logoUrl}" class="logo" />
                                    <h1 class="title">${property?.name || 'Financial Alert'}</h1>
                                    <div class="subtitle">${outlet?.name || ''} &bull; Transaction Revocation Logged</div>
                                </div>
                                
                                <div class="void-banner">❌ Transaction Void Action Detected</div>

                                <div class="content">
                                    <p>A finalized transaction has been voided. Please investigate the transaction record to confirm validity.</p>
                                    
                                    <table class="info-table">
                                        <tr><td class="info-label">Property context</td><td class="info-value">${property?.name}</td></tr>
                                        <tr><td class="info-label">Facility context</td><td class="info-value">${outlet?.name}</td></tr>
                                        <tr><td class="info-label">Receipt Number</td><td class="info-value">#${data.receipt_no}</td></tr>
                                        <tr><td class="info-label">Customer Name</td><td class="info-value">${data.guest_name}</td></tr>
                                        <tr><td class="info-label">Original Amount</td><td class="info-value">${data.currency} ${data.amount}</td></tr>
                                        <tr><td class="info-label">Void Reason</td><td class="info-value">${data.void_reason || 'Not specified'}</td></tr>
                                        <tr><td class="info-label">Authorized By</td><td class="info-value">${data.staff_name}</td></tr>
                                    </table>

                                    <p style="font-size: 12px; font-style: italic; color: #94a3b8; margin-top: 24px;">
                                        Audit recorded at: ${format(new Date(), 'HH:mm:ss dd/MM/yyyy')}
                                    </p>
                                </div>
                                
                                <div class="footer">
                                    ${property?.name || ''} &bull; Internal Intelligence Dispatch
                                </div>
                            </div>
                        </div>
                    </body>
                    </html>
                `;
            } else if (type === 'members_joined') {
                const outlet = outlets.find(o => o.id === data.outlet_id);
                subject = `🎉 New Enrollment: ${data.member_name} - ${property?.name || ''} (${outlet?.name || ''})`;
                html = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: 'Inter', -apple-system, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; }
                            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #f0fdf4; }
                            .card { background: #ffffff; border-radius: 24px; padding: 40px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); border: 1px solid #dcfce7; }
                            .header { text-align: center; margin-bottom: 32px; }
                            .logo { width: 64px; height: 64px; border-radius: 16px; margin-bottom: 16px; object-fit: cover; border: 2px solid #f1f5f9; }
                            .title { font-size: 20px; font-weight: 900; color: #166534; text-transform: uppercase; letter-spacing: -0.025em; margin: 0; }
                            .subtitle { font-size: 10px; font-weight: 700; color: #15803d; text-transform: uppercase; letter-spacing: 0.2em; margin-top: 4px; }
                            .divider { height: 1px; background: #f1f5f9; margin: 24px 0; }
                            .content { font-size: 14px; color: #475569; }
                            .info-table { width: 100%; border-collapse: separate; border-spacing: 0 8px; margin: 20px 0; }
                            .info-label { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; width: 40%; }
                            .info-value { font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; }
                            .footer { text-align: center; margin-top: 32px; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 20px; }
                            .success-banner { background: #dcfce7; color: #166534; padding: 12px; border-radius: 12px; text-align: center; font-weight: 800; font-size: 11px; text-transform: uppercase; margin-bottom: 24px; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="card">
                                <div class="header">
                                    <img src="${logoUrl}" class="logo" />
                                    <h1 class="title">${property?.name || 'Growth Update'}</h1>
                                    <div class="subtitle">${outlet?.name || ''} &bull; Membership Acquisition Successful</div>
                                </div>
                                
                                <div class="success-banner">🎉 New Member Acquisition Logged</div>

                                <div class="content">
                                    <p>A new membership contract has been finalized. Welcome our newest member to the community.</p>
                                    
                                    <table class="info-table">
                                        <tr><td class="info-label">Property context</td><td class="info-value">${property?.name}</td></tr>
                                        <tr><td class="info-label">Facility context</td><td class="info-value">${outlet?.name}</td></tr>
                                        <tr><td class="info-label">Member Name</td><td class="info-value">${data.member_name}</td></tr>
                                        <tr><td class="info-label">Membership Tier</td><td class="info-value">${data.category_name}</td></tr>
                                        <tr><td class="info-label">Investment Amount</td><td class="info-value">${data.currency} ${data.amount}</td></tr>
                                        <tr><td class="info-label">Sales Representative</td><td class="info-value">${data.staff_name}</td></tr>
                                    </table>

                                    <p style="font-size: 12px; font-style: italic; color: #94a3b8; margin-top: 24px;">
                                        Audit recorded at: ${format(new Date(), 'HH:mm:ss dd/MM/yyyy')}
                                    </p>
                                </div>
                                
                                <div class="footer">
                                    ${property?.name || ''} &bull; Internal Intelligence Dispatch
                                </div>
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
    const logoUrl = property.logo_url || 'https://picsum.photos/seed/tth/200/200';

    const [revenueData, currencies, settings] = await Promise.all([
      this.fetchRevenueData(property.id, outlet === 'all' ? 'all' : outlet.id, date),
      db.getCurrencies(),
      db.getSettings()
    ]);

    const defaultCurrency = (settings && currencies.find(c => c.id === settings.currency_id)) || currencies.find(c => c.is_default) || currencies[0];
    const currencySymbol = defaultCurrency?.symbol || '';
    const totalRevenue = revenueData.reduce((sum, item) => sum + item.amount, 0);
    const totalCount = revenueData.reduce((sum, item) => sum + item.count, 0);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Inter', -apple-system, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #f8fafc; }
          .card { background: #ffffff; border-radius: 24px; padding: 40px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; }
          .header { text-align: center; margin-bottom: 32px; }
          .logo { width: 80px; height: 80px; border-radius: 20px; margin-bottom: 20px; object-fit: cover; border: 4px solid #f1f5f9; }
          .title { font-size: 24px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: -0.025em; margin: 0; }
          .subtitle { font-size: 12px; font-weight: 700; color: #6366f1; text-transform: uppercase; letter-spacing: 0.2em; margin-top: 8px; }
          .divider { height: 1px; background: #f1f5f9; margin: 32px 0; }
          .content { font-size: 14px; color: #475569; }
          .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0; }
          .stat-card { background: #f8fafc; padding: 20px; border-radius: 16px; border: 1px solid #f1f5f9; }
          .stat-label { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; }
          .stat-value { font-size: 18px; font-weight: 900; color: #0f172a; }
          .footer { text-align: center; margin-top: 32px; font-size: 11px; color: #94a3b8; }
          .btn { display: inline-block; background: #6366f1; color: #ffffff; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 24px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <img src="${logoUrl}" class="logo" />
              <h1 class="title">${property.name}</h1>
              <div class="subtitle">Daily Revenue Intelligence</div>
            </div>
            
            <div class="content">
              <p>Greetings Administrator,</p>
              <p>The daily financial performance report for <strong>${outletName}</strong> is now ready for your review. This report encapsulates all strategic revenue streams processed on <strong>${dateStr}</strong>.</p>
              
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

              <p>Please find the detailed PDF intelligence report attached to this communication for a comprehensive breakdown of departmental yields and volume analysis.</p>
              
              <center>
                <a href="#" class="btn">View Online Dashboard</a>
              </center>
            </div>
            
            <div class="divider"></div>
            
            <div class="footer">
              <p>This is an automated intelligence dispatch from the TTH Management System.<br/>
              © ${new Date().getFullYear()} ${property.name}. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }
};
