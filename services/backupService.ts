import * as XLSX from 'xlsx';
import { db } from './mockSupabase';
import { format } from 'date-fns';
import { emailService } from './emailService';

export const backupService = {
  async generatePropertyBackupExcel(propertyId: string) {
    const [
      allProperties,
      allOutlets,
      members,
      sales,
      massageBookings,
      ptMembers,
      ptSessions,
      entranceFees,
      inventory,
      staff
    ] = await Promise.all([
      db.getProperties(),
      db.getOutlets(),
      db.getMembers(propertyId, true),
      db.getSales(propertyId, true),
      db.getMassageBookings(propertyId, true),
      db.getPTMembers(propertyId, true),
      db.getAllPTSessions(propertyId, true),
      db.getEntranceFeeConsents(propertyId, true),
      db.getInventory(propertyId, true),
      db.getStaff(propertyId)
    ]);

    const property = allProperties.find(p => p.id === propertyId);
    const outlets = allOutlets.filter(o => o.property_id === propertyId);

    const wb = XLSX.utils.book_new();

    // Helper to add sheet if data exists
    const addSheet = (data: any[], name: string) => {
      if (data && data.length > 0) {
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, name);
      }
    };

    addSheet(members, 'Memberships');
    addSheet(sales, 'Sales');
    addSheet(massageBookings, 'Massage Bookings');
    addSheet(ptMembers, 'PT Members');
    addSheet(ptSessions, 'PT Sessions');
    addSheet(entranceFees, 'Entrance Fees');
    addSheet(inventory, 'Inventory');
    addSheet(staff, 'Staff');
    addSheet(outlets, 'Outlets');

    // Generate buffer
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    return {
      buffer: excelBuffer,
      propertyName: property?.name || 'Property',
      fileName: `${(property?.name || 'Property').replace(/\s+/g, '_')}_Backup_${format(new Date(), 'yyyy-MM-dd')}.xlsx`
    };
  },

  async sendDailyBackup(propertyId: string, recipientEmail: string) {
    try {
      const { buffer, propertyName, fileName } = await this.generatePropertyBackupExcel(propertyId);
      
      // In a real environment, we would use an email provider that supports attachments.
      // emailService usually sends HTML. We'll simulate the attachment part.
      
      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #0f172a; border-bottom: 2px solid #6366f1; padding-bottom: 10px;">Daily Data Backup</h2>
          <p>Hello,</p>
          <p>Attached is the daily automated data backup for <strong>${propertyName}</strong>.</p>
          <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #64748b;"><strong>Property:</strong> ${propertyName}</p>
            <p style="margin: 5px 0 0 0; font-size: 14px; color: #64748b;"><strong>Generated On:</strong> ${format(new Date(), 'dd MMMM yyyy HH:mm:ss')}</p>
          </div>
          <p style="font-size: 13px; color: #94a3b8;">This is an automated system message. Please do not reply.</p>
        </div>
      `;

      // We'll call a simulated email send with attachment
      await emailService.sendEmail(
        recipientEmail,
        `Daily Data Backup - ${propertyName} - ${format(new Date(), 'dd MMM yyyy')}`,
        html,
        [
          {
            filename: fileName,
            content: buffer.toString('base64')
          }
        ]
      );

      return { success: true, fileName };
    } catch (error: any) {
      console.error('Backup failed:', error);
      throw error;
    }
  }
};
