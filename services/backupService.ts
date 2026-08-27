import * as XLSX from 'xlsx';
import { db } from './mockSupabase';
import { format } from 'date-fns';
import { emailService } from './emailService';

// Excel limits individual cell text length strictly to 32,767 characters.
// We clean and truncate huge base64 signatures/photos and complex objects.
function sanitizeRowForExcel(row: any): Record<string, any> {
  if (!row || typeof row !== 'object') return {};
  const cleaned: Record<string, any> = {};

  for (const [key, val] of Object.entries(row)) {
    if (val === null || val === undefined) {
      cleaned[key] = '';
    } else if (typeof val === 'boolean' || typeof val === 'number') {
      cleaned[key] = val;
    } else if (typeof val === 'string') {
      // Check if value is a data URL / base64 image or signature
      if (val.startsWith('data:image/') || (val.length > 500 && /^[A-Za-z0-9+/=]+$/.test(val.substring(0, 100)))) {
        cleaned[key] = '[Digital Signature/Image File Attached in Database]';
      } else if (val.length > 32000) {
        cleaned[key] = val.substring(0, 32000) + '... [Truncated for Excel Cell Limit]';
      } else {
        cleaned[key] = val;
      }
    } else if (typeof val === 'object') {
      try {
        const jsonStr = JSON.stringify(val);
        if (jsonStr.length > 32000) {
          cleaned[key] = jsonStr.substring(0, 32000) + '... [Truncated]';
        } else {
          cleaned[key] = jsonStr;
        }
      } catch {
        cleaned[key] = String(val);
      }
    } else {
      cleaned[key] = String(val);
    }
  }

  return cleaned;
}

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
      db.getProperties().catch(() => []),
      db.getOutlets().catch(() => []),
      db.getMembers(propertyId, true).catch(() => []),
      db.getSales(propertyId, true).catch(() => []),
      db.getMassageBookings(propertyId, true).catch(() => []),
      db.getPTMembers(propertyId, true).catch(() => []),
      db.getAllPTSessions(propertyId, true).catch(() => []),
      db.getEntranceFeeConsents(propertyId, true).catch(() => []),
      db.getInventory(propertyId, true).catch(() => []),
      db.getStaff(propertyId).catch(() => [])
    ]);

    const property = (allProperties || []).find(p => p.id === propertyId);
    const outlets = (allOutlets || []).filter(o => o.property_id === propertyId);

    const wb = XLSX.utils.book_new();

    // Helper to add sheet if data exists
    const addSheet = (data: any[], name: string) => {
      if (Array.isArray(data) && data.length > 0) {
        const sanitized = data.map(sanitizeRowForExcel);
        const ws = XLSX.utils.json_to_sheet(sanitized);
        XLSX.utils.book_append_sheet(wb, ws, name);
      } else {
        // Add an empty sheet with a note
        const ws = XLSX.utils.json_to_sheet([{ Status: 'No records found for this property' }]);
        XLSX.utils.book_append_sheet(wb, ws, name);
      }
    };

    addSheet(members, 'Memberships');
    addSheet(sales, 'Sales & Invoices');
    addSheet(massageBookings, 'Massage Bookings');
    addSheet(ptMembers, 'PT Members');
    addSheet(ptSessions, 'PT Sessions');
    addSheet(entranceFees, 'Entrance Fees');
    addSheet(inventory, 'Inventory');
    addSheet(staff, 'Staff');
    addSheet(outlets, 'Outlets');

    // Generate base64 string directly compatible with email attachments
    const base64Content = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    const propertyName = property?.name || 'Property';
    const fileName = `${propertyName.replace(/[^a-zA-Z0-9_-]/g, '_')}_Backup_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;

    return {
      base64Content,
      propertyName,
      fileName
    };
  },

  async sendDailyBackup(propertyId: string, recipientEmail: string) {
    try {
      const { base64Content, propertyName, fileName } = await this.generatePropertyBackupExcel(propertyId);
      
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #0f172a; margin: 0; font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">Daily Data Backup</h2>
            <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Automated Data Consolidation Report</p>
          </div>
          
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">Hello,</p>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">Attached is the consolidated daily automated data backup spreadsheet for <strong>${propertyName}</strong>.</p>
          
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 12px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: bold; width: 40%;">Property:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: bold;">${propertyName}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: bold;">Export Timestamp:</td>
                <td style="padding: 6px 0; color: #0f172a;">${format(new Date(), 'dd MMMM yyyy HH:mm:ss')}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: bold;">Attachment:</td>
                <td style="padding: 6px 0; color: #4f46e5; font-weight: bold;">${fileName}</td>
              </tr>
            </table>
          </div>

          <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 24px;">
            This automated export includes Memberships, Sales, Treatments, Personal Training records, Consents, Inventory, and Staff accounts.
          </p>
        </div>
      `;

      const result = await emailService.sendEmail(
        recipientEmail,
        `Daily Data Backup - ${propertyName} - ${format(new Date(), 'dd MMM yyyy')}`,
        html,
        [
          {
            filename: fileName,
            content: base64Content
          }
        ]
      );

      if (result && result.success === false) {
        throw new Error(result.error || 'Failed to deliver backup email');
      }

      return { success: true, fileName };
    } catch (error: any) {
      console.error('[Backup Service Error]:', error);
      throw error;
    }
  }
};
