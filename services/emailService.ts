import { reportService } from './reportService';
import { db } from './mockSupabase';
import { format } from 'date-fns';

export const emailService = {
  async sendEmail(to: string, subject: string, html: string, attachments: { filename: string; content: string }[] = []) {
    // In a real app, this would call a Supabase Edge Function or an email API (SendGrid, Postmark, etc.)
    console.log(`[Email Simulation] Sending email to: ${to}`);
    console.log(`[Email Simulation] Subject: ${subject}`);
    console.log(`[Email Simulation] Attachments: ${attachments.length}`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return { success: true, messageId: Math.random().toString(36).substring(7) };
  }
};

export const schedulerService = {
  async processScheduledReports() {
    const now = new Date();
    const currentTime = format(now, 'HH:mm');
    
    try {
      const recipients = await db.getReportRecipients();
      const properties = await db.getProperties();
      const outlets = await db.getOutlets();

      for (const recipient of recipients) {
        if (!recipient.is_active) continue;
        
        // Check if it's time to send
        if (recipient.send_time === currentTime) {
          console.log(`[Scheduler] Triggering report for ${recipient.email} at ${recipient.send_time}`);
          
          const property = properties.find(p => p.id === recipient.property_id);
          if (!property) continue;

          const outlet = recipient.outlet_id === 'all' 
            ? 'all' 
            : outlets.find(o => o.id === recipient.outlet_id);
          
          if (!outlet) continue;

          // Generate Report
          const pdf = await reportService.generateDailyRevenuePDF(property, outlet, now);
          const pdfBase64 = pdf.output('datauristring').split(',')[1];
          
          // Generate Email HTML
          const html = await reportService.generateEmailTemplate(property, outlet, now);
          
          // Send Email
          await emailService.sendEmail(
            recipient.email,
            `Daily Revenue Report - ${property.name} - ${format(now, 'dd MMM yyyy')}`,
            html,
            [{ filename: `Daily_Revenue_${format(now, 'yyyyMMdd')}.pdf`, content: pdfBase64 }]
          );
        }
      }
    } catch (error) {
      console.error('[Scheduler] Error processing reports:', error);
    }
  }
};
