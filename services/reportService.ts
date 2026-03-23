import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { format, startOfDay } from 'date-fns';
import { db } from './mockSupabase';
import { Property, Outlet, MemberStatus } from '../types';

export const reportService = {
  async fetchRevenueData(propertyId: string, outletId: string | 'all', date: Date = new Date()) {
    const start = startOfDay(date);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);

    const [members, sales, bookings, categories, mTypes] = await Promise.all([
      db.getMembers(outletId === 'all' ? propertyId : outletId, outletId === 'all'),
      db.getSales(outletId === 'all' ? propertyId : outletId, outletId === 'all'),
      db.getMassageBookings(outletId === 'all' ? propertyId : outletId, outletId === 'all'),
      db.getCategories(outletId === 'all' ? propertyId : outletId),
      db.getMembershipTypes(outletId === 'all' ? propertyId : outletId)
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

    // Fetch Real Data
    const revenueData = await this.fetchRevenueData(property.id, outlet === 'all' ? 'all' : outlet.id, date);
    const totalRevenue = revenueData.reduce((sum, item) => sum + item.amount, 0);

    // Table
    (doc as any).autoTable({
      startY: 50,
      head: [['Strategic Category', 'Volume', 'Net Revenue']],
      body: revenueData.map(item => [
        item.category,
        item.count.toString(),
        `QAR ${item.amount.toLocaleString()}`
      ]),
      foot: [['TOTAL PORTFOLIO YIELD', '', `QAR ${totalRevenue.toLocaleString()}`]],
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 5 }
    });

    // Footer
    const finalY = (doc as any).lastAutoTable.finalY + 20;
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text('This report is generated automatically by the TTH Management Protocol.', 105, finalY, { align: 'center' });
    doc.text(`© ${new Date().getFullYear()} ${property.name}. All rights reserved.`, 105, finalY + 5, { align: 'center' });

    return doc;
  },

  async generateEmailTemplate(property: Property, outlet: Outlet | 'all', date: Date = new Date()) {
    const dateStr = format(date, 'dd MMM yyyy');
    const outletName = outlet === 'all' ? 'All Outlets (Consolidated)' : outlet.name;
    const logoUrl = property.logo_url || 'https://picsum.photos/seed/tth/200/200';

    const revenueData = await this.fetchRevenueData(property.id, outlet === 'all' ? 'all' : outlet.id, date);
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
                  <div class="stat-value">QAR ${totalRevenue.toLocaleString()}</div>
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
              <p>This is an automated intelligence dispatch from the TTH Management Protocol.<br/>
              © ${new Date().getFullYear()} ${property.name}. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }
};
