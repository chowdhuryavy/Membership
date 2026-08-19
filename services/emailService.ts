import { db } from './mockSupabase';
import { supabase } from './supabase';
import { format, parseISO, differenceInCalendarDays, startOfDay } from 'date-fns';
import { generateMemberAgreementPdfBase64 } from './memberAgreementPdfService';
import { Member, MemberStatus, ExpirationReminderConfig, ExpirationReminderOutletConfig, ExpirationReminderLog } from '../types';

const recentlySentMembersSet = new Set<string>();

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

export function buildBoxedEmailHtml(params: {
  bannerType?: 'success' | 'warning' | 'alert' | 'info';
  bannerText?: string;
  logoUrl?: string;
  propertyName: string;
  outletName?: string;
  subtitle?: string;
  greeting?: string;
  introParagraph?: string;
  calloutBox?: string;
  dataFields: Array<{ label: string; value: string }>;
  amountBox?: {
    label: string;
    amount: string | number;
    currency?: string;
    subtext?: string;
  };
  footerText?: string;
  timestamp?: string;
}): string {
  const bannerBg = params.bannerType === 'warning' ? '#fef3c7'
    : params.bannerType === 'alert' ? '#fee2e2'
    : params.bannerType === 'info' ? '#e0f2fe'
    : '#dcfce7';

  const bannerColor = params.bannerType === 'warning' ? '#92400e'
    : params.bannerType === 'alert' ? '#991b1b'
    : params.bannerType === 'info' ? '#0369a1'
    : '#166534';

  const defaultBannerText = params.bannerType === 'warning' ? 'MEMBERSHIP FREEZE LOGGED'
    : params.bannerType === 'alert' ? 'TRANSACTION VOID LOGGED'
    : params.bannerType === 'info' ? 'SYSTEM INFORMATION DISPATCH'
    : 'MEMBERSHIP ENROLLMENT CONFIRMED';

  const banner = params.bannerText || defaultBannerText;
  const propName = params.propertyName || 'HEALTH CLUB';
  const outlet = params.outletName || 'CLUB';
  const sub = params.subtitle || 'OFFICIAL MEMBERSHIP ENROLLMENT';
  const greeting = params.greeting !== undefined ? params.greeting : 'Dear Admin,';

  const dataRowsHtml = params.dataFields.map((f, i) => `
    <tr>
      <td style="padding: 10px 12px 10px 0; font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; width: 42%; vertical-align: top; text-align: left; ${i < params.dataFields.length - 1 ? 'border-bottom: 1px solid #e2e8f0;' : ''}">
        ${f.label}
      </td>
      <td style="padding: 10px 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; font-weight: bold; color: #0f172a; vertical-align: top; text-align: left; ${i < params.dataFields.length - 1 ? 'border-bottom: 1px solid #e2e8f0;' : ''}">
        ${f.value || 'N/A'}
      </td>
    </tr>
  `).join('');

  const amountValueFormatted = params.amountBox
    ? (typeof params.amountBox.amount === 'number'
        ? params.amountBox.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : params.amountBox.amount)
    : '';

  const amountTableHtml = params.amountBox ? `
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 20px 0 10px 0;">
      <tr>
        <td bgcolor="#0f172a" align="center" style="background-color: #0f172a; border-radius: 8px; padding: 18px 24px; text-align: center;">
          <div style="font-family: Arial, Helvetica, sans-serif; font-size: 10px; font-weight: bold; color: #a5b4fc; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px;">
            ${params.amountBox.label}
          </div>
          <div style="font-family: Arial, Helvetica, sans-serif; font-size: 26px; font-weight: bold; color: #ffffff; margin: 2px 0;">
            ${amountValueFormatted}${params.amountBox.currency ? ` ${params.amountBox.currency}` : ''}
          </div>
          ${params.amountBox.subtext ? `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #94a3b8; margin-top: 4px;">${params.amountBox.subtext}</div>` : ''}
        </td>
      </tr>
    </table>
  ` : '';

  const calloutTableHtml = params.calloutBox ? `
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 16px 0;">
      <tr>
        <td bgcolor="#f0f9ff" style="background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 12px 16px; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #0369a1; font-weight: 500;">
          ${params.calloutBox}
        </td>
      </tr>
    </table>
  ` : '';

  // Avoid untrusted external image hosts (imgur, ui-avatars) that cause Microsoft Defender to convert emails to plain text
  const isSuspiciousImageHost = !params.logoUrl ||
    params.logoUrl.includes('ui-avatars.com') ||
    params.logoUrl.includes('imgur.com') ||
    params.logoUrl.includes('placeholder.com');

  const logoHtml = !isSuspiciousImageHost ? `
    <img src="${params.logoUrl}" width="140" style="max-width: 140px; max-height: 70px; margin-bottom: 12px; object-fit: contain; display: block;" alt="${propName}" />
  ` : '';

  const timeStr = params.timestamp || format(new Date(), 'HH:mm:ss dd/MM/yyyy');

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${propName} Dispatch</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: Arial, Helvetica, sans-serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; table-layout: fixed; padding: 24px 10px;">
    <tr>
      <td align="center">
        <!--[if (gte mso 9)|(IE)]>
        <table align="center" border="0" cellspacing="0" cellpadding="0" width="600">
        <tr>
        <td align="center" valign="top" width="600">
        <![endif]-->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          
          <!-- TOP BANNER -->
          <tr>
            <td bgcolor="${bannerBg}" style="background-color: ${bannerBg}; color: ${bannerColor}; padding: 12px 24px; font-family: Arial, Helvetica, sans-serif; font-weight: bold; font-size: 11px; text-transform: uppercase; text-align: left; letter-spacing: 0.05em;">
              ${banner}
            </td>
          </tr>

          <!-- HEADER -->
          <tr>
            <td style="padding: 24px 30px 16px 30px; text-align: left;">
              ${logoHtml}
              <h1 style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 22px; font-weight: bold; color: #0f172a; text-transform: uppercase; letter-spacing: -0.01em;">${propName}</h1>
              <div style="font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 4px;">${outlet} &bull; ${sub}</div>
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 16px;">
                <tr><td height="2" bgcolor="#0f172a" style="background-color: #0f172a; font-size: 1px; line-height: 1px;">&nbsp;</td></tr>
              </table>
            </td>
          </tr>

          <!-- CONTENT BODY -->
          <tr>
            <td style="padding: 0 30px 24px 30px; font-family: Arial, Helvetica, sans-serif; color: #334155; font-size: 14px; line-height: 1.6;">
              ${greeting ? `<p style="margin: 0 0 12px 0; font-family: Arial, Helvetica, sans-serif; font-weight: bold; color: #0f172a;">${greeting}</p>` : ''}
              ${params.introParagraph ? `<p style="margin: 0 0 16px 0; font-family: Arial, Helvetica, sans-serif; color: #475569; font-size: 13px; line-height: 1.5;">${params.introParagraph}</p>` : ''}
              ${calloutTableHtml}

              <!-- SHADED DATA CONTAINER TABLE -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 16px 0;">
                <tr>
                  <td bgcolor="#f8fafc" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px;">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                      ${dataRowsHtml}
                    </table>
                  </td>
                </tr>
              </table>

              ${amountTableHtml}
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td bgcolor="#ffffff" style="background-color: #ffffff; padding: 20px 30px 24px 30px; text-align: center; border-top: 1px solid #f1f5f9; font-family: Arial, Helvetica, sans-serif; font-size: 11px; line-height: 1.5; color: #94a3b8;">
              <div style="font-weight: bold; color: #64748b;">${propName} &bull; ${outlet}</div>
              <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Verified Member Enrollment System &bull; Confidential</div>
              <div style="font-size: 10px; font-style: italic; color: #cbd5e1; margin-top: 8px;">Audit recorded at: ${timeStr}</div>
            </td>
          </tr>

        </table>
        <!--[if (gte mso 9)|(IE)]>
        </td>
        </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildGuestExpirationReminderEmailHtml(params: {
  guestName: string;
  memberNumber: string;
  membershipType?: string;
  packageType?: string;
  accessType?: string;
  startDate?: string;
  endDate: string;
  daysRemaining: number;
  propertyName: string;
  outletName: string;
  logoUrl?: string;
  phone?: string;
  address?: string;
  customMessage?: string;
  renewalEmail?: string;
}): string {
  const propName = params.propertyName || 'LUXURY HEALTH CLUB';
  const outlet = params.outletName || 'FITNESS & WELLNESS';
  const guest = params.guestName || 'Valued Member';
  const memberNo = params.memberNumber || 'N/A';
  const pkg = params.packageType || 'Annual Membership';
  const access = params.accessType || 'Full Facility Access';
  const memType = params.membershipType || 'Standard';

  let bannerBg = '#eef2ff';
  let bannerColor = '#3730a3';
  let bannerBorder = '#c7d2fe';
  let bannerText = `COURTESY RENEWAL NOTICE &bull; ${params.daysRemaining} DAYS REMAINING`;
  let countdownTitle = `${params.daysRemaining} DAYS REMAINING`;

  if (params.daysRemaining <= 0) {
    bannerBg = '#fef2f2';
    bannerColor = '#991b1b';
    bannerBorder = '#fecaca';
    bannerText = 'MEMBERSHIP EXPIRED TODAY &bull; RENEWAL REQUIRED';
    countdownTitle = 'EXPIRES TODAY';
  } else if (params.daysRemaining === 1) {
    bannerBg = '#fffbeb';
    bannerColor = '#92400e';
    bannerBorder = '#fde68a';
    bannerText = 'CRITICAL REMINDER &bull; EXPIRES TOMORROW';
    countdownTitle = 'EXPIRES IN 24 HOURS';
  } else if (params.daysRemaining <= 7) {
    bannerBg = '#fffbeb';
    bannerColor = '#b45309';
    bannerBorder = '#fde68a';
    bannerText = `EXPIRING SOON &bull; ${params.daysRemaining} DAYS REMAINING`;
  }

  const isSuspiciousImageHost = !params.logoUrl ||
    params.logoUrl.includes('placeholder.com');

  const logoHtml = !isSuspiciousImageHost && params.logoUrl ? `
    <div style="margin-bottom: 16px;">
      <img src="${params.logoUrl}" width="130" style="max-width: 130px; max-height: 65px; object-fit: contain; display: block;" alt="${propName}" />
    </div>
  ` : '';

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Membership Expiration Reminder - ${propName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; table-layout: fixed; padding: 32px 12px;">
    <tr>
      <td align="center">
        <!--[if (gte mso 9)|(IE)]>
        <table align="center" border="0" cellspacing="0" cellpadding="0" width="600">
        <tr>
        <td align="center" valign="top" width="600">
        <![endif]-->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);">
          
          <!-- TOP STATUS STRIP -->
          <tr>
            <td bgcolor="${bannerBg}" style="background-color: ${bannerBg}; color: ${bannerColor}; padding: 12px 28px; font-family: Arial, Helvetica, sans-serif; font-weight: 800; font-size: 11px; text-transform: uppercase; text-align: left; letter-spacing: 0.08em; border-bottom: 1px solid ${bannerBorder};">
              ${bannerText}
            </td>
          </tr>

          <!-- BRAND HEADER -->
          <tr>
            <td style="padding: 30px 32px 20px 32px; text-align: left; background: #ffffff;">
              ${logoHtml}
              <div style="font-family: Arial, Helvetica, sans-serif; font-size: 10px; font-weight: 800; color: #6366f1; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px;">
                ${propName}
              </div>
              <h1 style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 22px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: -0.02em;">
                ${outlet}
              </h1>
              <div style="font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: 600; color: #64748b; margin-top: 4px;">
                Membership Services &bull; Expiration & Renewal Notice
              </div>
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 18px;">
                <tr><td height="2" bgcolor="#4f46e5" style="background-color: #4f46e5; font-size: 1px; line-height: 1px;">&nbsp;</td></tr>
              </table>
            </td>
          </tr>

          <!-- MAIN CONTENT -->
          <tr>
            <td style="padding: 0 32px 28px 32px; font-family: Arial, Helvetica, sans-serif; color: #334155; font-size: 14px; line-height: 1.6;">
              <p style="margin: 0 0 14px 0; font-family: Arial, Helvetica, sans-serif; font-size: 16px; font-weight: 700; color: #0f172a;">
                Dear ${guest},
              </p>
              <p style="margin: 0 0 18px 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #475569; line-height: 1.6;">
                Thank you for being a valued member of <strong>${outlet}</strong> at <strong>${propName}</strong>. We hope you are enjoying your health, fitness, and wellness journey with us.
              </p>
              <p style="margin: 0 0 20px 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #475569; line-height: 1.6;">
                This is a courtesy notification that your current membership term is scheduled to expire on <strong>${params.endDate}</strong>.
              </p>

              <!-- HIGHLIGHT COUNTDOWN CARD -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td bgcolor="#0f172a" align="center" style="background-color: #0f172a; border-radius: 12px; padding: 22px 24px; text-align: center;">
                    <div style="font-family: Arial, Helvetica, sans-serif; font-size: 10px; font-weight: 800; color: #a5b4fc; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px;">
                      VALIDITY STATUS
                    </div>
                    <div style="font-family: Arial, Helvetica, sans-serif; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.01em;">
                      ${countdownTitle}
                    </div>
                    <div style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; font-weight: 600; color: #cbd5e1; margin-top: 6px;">
                      Official Expiry Date: <span style="color: #f8fafc; font-weight: 700;">${params.endDate}</span>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- MEMBERSHIP PARTICULARS TABLE -->
              <div style="font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px;">
                Membership Particulars
              </div>
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 0 22px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 6px 10px 6px 0; font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; width: 42%;">Member Name</td>
                        <td style="padding: 6px 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; font-weight: 700; color: #0f172a;">${guest}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 10px 6px 0; font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; border-top: 1px solid #e2e8f0;">Membership Number</td>
                        <td style="padding: 6px 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; font-weight: 800; color: #4f46e5; border-top: 1px solid #e2e8f0;">${memberNo}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 10px 6px 0; font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; border-top: 1px solid #e2e8f0;">Package & Category</td>
                        <td style="padding: 6px 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; font-weight: 600; color: #0f172a; border-top: 1px solid #e2e8f0;">${pkg} &bull; ${memType}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 10px 6px 0; font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; border-top: 1px solid #e2e8f0;">Facility Access</td>
                        <td style="padding: 6px 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; font-weight: 600; color: #0f172a; border-top: 1px solid #e2e8f0;">${access}</td>
                      </tr>
                      ${params.startDate ? `
                      <tr>
                        <td style="padding: 6px 10px 6px 0; font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; border-top: 1px solid #e2e8f0;">Start Date</td>
                        <td style="padding: 6px 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; font-weight: 600; color: #0f172a; border-top: 1px solid #e2e8f0;">${params.startDate}</td>
                      </tr>
                      ` : ''}
                      <tr>
                        <td style="padding: 6px 10px 6px 0; font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; border-top: 1px solid #e2e8f0;">Expiration Date</td>
                        <td style="padding: 6px 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; font-weight: 800; color: #b45309; border-top: 1px solid #e2e8f0;">${params.endDate}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CUSTOM MESSAGE (IF CONFIGURED) -->
              ${params.customMessage ? `
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 0 22px 0;">
                <tr>
                  <td bgcolor="#f5f3ff" style="background-color: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 10px; padding: 14px 18px; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #4338ca; line-height: 1.5;">
                    <div style="font-weight: 800; text-transform: uppercase; font-size: 10px; letter-spacing: 0.08em; margin-bottom: 4px; color: #6366f1;">Exclusive Renewal Benefit & Info</div>
                    ${params.customMessage}
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- RENEWAL ACTION CARD -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 10px; padding: 18px 20px; margin-bottom: 12px;">
                <tr>
                  <td>
                    <div style="font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">
                      How to Renew Your Membership:
                    </div>
                    <div style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #475569; line-height: 1.5;">
                      To ensure uninterrupted access to the gym, pool, spa facilities, and locker privileges, please visit our member reception desk or contact our team directly.
                    </div>
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 12px;">
                      ${params.phone ? `
                      <tr>
                        <td style="padding: 3px 0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #334155;">
                          <strong>Direct Telephone:</strong> <a href="tel:${params.phone}" style="color: #4f46e5; text-decoration: none; font-weight: 700;">${params.phone}</a>
                        </td>
                      </tr>
                      ` : ''}
                      ${params.renewalEmail ? `
                      <tr>
                        <td style="padding: 3px 0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #334155;">
                          <strong>Email Inquiries:</strong> <a href="mailto:${params.renewalEmail}" style="color: #4f46e5; text-decoration: none; font-weight: 700;">${params.renewalEmail}</a>
                        </td>
                      </tr>
                      ` : ''}
                      ${params.address ? `
                      <tr>
                        <td style="padding: 3px 0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #64748b;">
                          <strong>Location:</strong> ${params.address}
                        </td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin: 18px 0 0 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #64748b; line-height: 1.5;">
                We look forward to continuing to support your fitness and wellness goals for another successful year.
              </p>
              <p style="margin: 8px 0 0 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; font-weight: 700; color: #0f172a;">
                Warm regards,<br />
                <span style="font-weight: 600; color: #64748b;">The Membership & Wellness Team at ${outlet}</span>
              </p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td bgcolor="#ffffff" style="background-color: #ffffff; padding: 22px 32px 26px 32px; text-align: center; border-top: 1px solid #f1f5f9; font-family: Arial, Helvetica, sans-serif; font-size: 11px; line-height: 1.5; color: #94a3b8;">
              <div style="font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">${propName} &bull; ${outlet}</div>
              <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">Automated Guest Membership Courtesy Notification &bull; Confidential</div>
              <div style="font-size: 10px; font-style: italic; color: #cbd5e1; margin-top: 6px;">Generated on: ${format(new Date(), 'dd MMMM yyyy, HH:mm')}</div>
            </td>
          </tr>

        </table>
        <!--[if (gte mso 9)|(IE)]>
        </td>
        </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export const emailService = {
  async sendEmail(to: string | string[], subject: string, html: string, attachments: { filename: string; content: string }[] = []) {
    const targetStr = Array.isArray(to) ? to.join(', ') : to;
    console.log(`[Email Service] Dispatching email to: ${targetStr}`);
    console.log(`[Email Service] Subject: ${subject}`);
    console.log(`[Email Service] Attachments: ${attachments.length}`);

    let lastErrorMessage = '';

    // Primary Method: Send via Supabase Edge Function directly if available
    try {
      if (supabase) {
        const { data, error } = await supabase.functions.invoke('send-reports', {
          body: {
            directEmail: {
              to,
              subject,
              html,
              attachments
            }
          }
        });

        if (!error && data && data.success !== false) {
          console.log('[Email Service] Email successfully sent via Resend Edge Function:', data?.id);
          return { success: true, messageId: data?.id || Math.random().toString(36).substring(7) };
        } else {
          lastErrorMessage = error?.message || data?.error || 'Edge Function error';
          console.warn('[Email Service] Edge Function returned error, trying local Express fallback...', lastErrorMessage);
        }
      }
    } catch (err: any) {
      lastErrorMessage = err?.message || String(err);
      console.warn('[Email Service] Exception sending email via Edge Function, trying Express server fallback...', err);
    }

    // Fallback Method: Call Express server API endpoint
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, html, attachments })
      });
      
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        console.log('[Email Service] Email successfully sent via Express /api/send-email:', data.id);
        return { success: true, messageId: data.id };
      } else {
        const errorReason = data.error || `Server API failed with status ${res.status}`;
        console.error(`[Email Service] Express API failed with status ${res.status}:`, errorReason);
        return { success: false, error: errorReason };
      }
    } catch (apiErr: any) {
      console.warn('[Email Service] Express /api/send-email unreachable or failed:', apiErr);
      return { success: false, error: apiErr?.message || lastErrorMessage || 'Failed to dispatch email' };
    }
  },

  async sendReportEmail(
    recipients: string,
    reportTitle: string,
    propertyName: string,
    outletName: string,
    pdfBase64: string,
    summaryText?: string
  ) {
    const toList = recipients.split(',').map(e => e.trim()).filter(Boolean);
    if (toList.length === 0) return { success: false, error: 'No recipient email addresses provided' };

    const dateStr = format(new Date(), 'dd MMM yyyy');
    const subject = `${reportTitle} - ${propertyName} (${outletName}) - ${dateStr}`;
    const filename = `${reportTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`;

    const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${reportTitle} - ${propertyName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: Arial, Helvetica, sans-serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; table-layout: fixed; padding: 24px 10px;">
    <tr>
      <td align="center">
        <!--[if (gte mso 9)|(IE)]>
        <table align="center" border="0" cellspacing="0" cellpadding="0" width="600">
        <tr>
        <td align="center" valign="top" width="600">
        <![endif]-->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <tr>
            <td bgcolor="#0f172a" style="background-color: #0f172a; color: #ffffff; padding: 12px 24px; font-family: Arial, Helvetica, sans-serif; font-weight: bold; font-size: 11px; text-transform: uppercase; text-align: left; letter-spacing: 0.05em;">
              EXECUTIVE REPORT &bull; ${dateStr}
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 30px 16px 30px; text-align: left;">
              <h1 style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 22px; font-weight: bold; color: #0f172a; text-transform: uppercase; letter-spacing: -0.01em;">${propertyName}</h1>
              <div style="font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px;">${reportTitle} &bull; ${outletName}</div>
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 16px;">
                <tr><td height="2" bgcolor="#0f172a" style="background-color: #0f172a; font-size: 1px; line-height: 1px;">&nbsp;</td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 30px 24px 30px; font-family: Arial, Helvetica, sans-serif; color: #334155; font-size: 14px; line-height: 1.6;">
              <p style="margin: 0 0 12px 0; font-weight: bold; color: #0f172a;">Dear Administrator,</p>
              <p style="margin: 0 0 16px 0; color: #475569; font-size: 13px; line-height: 1.5;">
                The official <strong>${reportTitle}</strong> for <strong>${outletName}</strong> (${propertyName}) has been generated. The full audit ledger is attached as a PDF.
              </p>
              ${summaryText ? `
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 16px 0;">
                <tr>
                  <td bgcolor="#f8fafc" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #334155;">
                    ${summaryText}
                  </td>
                </tr>
              </table>
              ` : ''}
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" style="background-color: #ffffff; padding: 16px 30px 20px 30px; text-align: center; border-top: 1px solid #f1f5f9; font-family: Arial, Helvetica, sans-serif; font-size: 11px; line-height: 1.5; color: #94a3b8;">
              <div style="font-weight: bold; color: #64748b;">${propertyName} &bull; ${outletName}</div>
              <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Automated System Dispatch</div>
            </td>
          </tr>
        </table>
        <!--[if (gte mso 9)|(IE)]>
        </td>
        </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;

    let lastResult: any = { success: false, error: 'No emails sent' };
    for (const recipient of toList) {
      lastResult = await this.sendEmail(recipient, subject, html, [{ filename, content: pdfBase64 }]);
    }
    return lastResult;
  },

  async sendMemberPurchaseEmail(member: any) {
    const memberKey = `${member?.id || ''}_${member?.membership_number || ''}_${member?.guest_name || ''}`;
    if (recentlySentMembersSet.has(memberKey)) {
      console.log(`[Email Service] Skipping duplicate sendMemberPurchaseEmail call for key: ${memberKey}`);
      return;
    }
    recentlySentMembersSet.add(memberKey);
    setTimeout(() => recentlySentMembersSet.delete(memberKey), 10000);

    console.log('[Email Service] sendMemberPurchaseEmail triggered for member:', member?.id || member?.guest_name);
    try {
      const properties = await db.getProperties();
      const outlets = await db.getOutlets();
      const recipients = await db.getReportRecipients();
      const settings = await db.getSettings();
      const currencies = await db.getCurrencies();

      const outlet = outlets.find(o => o.id === member.outlet_id);
      const property = outlet ? properties.find(p => p.id === outlet.property_id) : properties[0];
      const currency = (settings && currencies.find(c => c.id === settings.currency_id)) || currencies[0];
      const symbol = currency?.symbol || 'QAR';

      // Find recipients configured for members_joined, or all active recipients for property and outlet
      let targetEmails: string[] = [];
      const purchasedRecipients = recipients.filter(r => r.is_active && r.report_type === 'members_joined' && (!r.property_id || r.property_id === property?.id) && (r.outlet_id === 'all' || r.outlet_id === member.outlet_id));
      
      if (purchasedRecipients.length > 0) {
        targetEmails = purchasedRecipients.flatMap(r => r.email.split(',').map(e => e.trim()));
      } else {
        const activeRecipients = recipients.filter(r => r.is_active && (!r.property_id || r.property_id === property?.id) && (r.outlet_id === 'all' || r.outlet_id === member.outlet_id));
        targetEmails = activeRecipients.flatMap(r => r.email.split(',').map(e => e.trim()));
      }

      targetEmails = Array.from(new Set(targetEmails.filter(Boolean)));
      console.log(`[Email Service] Targeted recipients for purchase: ${targetEmails.length}`, targetEmails);
      
      if (targetEmails.length === 0) {
        console.log('[Email Service] No recipient emails found for member purchase notification.');
        return;
      }

      // Generate Member Agreement PDF Attachment
      let pdfBase64 = '';
      try {
        pdfBase64 = await generateMemberAgreementPdfBase64(member, outlet, property, settings);
      } catch (pdfErr) {
        console.error('[Email Service] Error generating Member Agreement PDF base64:', pdfErr);
      }

      const rawContractTemplate = outlet?.contract_template || (property as any)?.contract_template || (settings as any)?.contract_template || 'Standard Health Club Membership Agreement';
      const rawTermsConditions = outlet?.conditions || (property as any)?.conditions || (settings as any)?.conditions || 'All club rules and regulations apply.';

      // Replace template placeholders if present
      const cleanContract = rawContractTemplate
        .replace(/\{\{guest_name\}\}/g, member.guest_name || 'Member')
        .replace(/\{\{membership_number\}\}/g, member.membership_number || '')
        .replace(/\{\{start_date\}\}/g, member.start_date || '')
        .replace(/\{\{end_date\}\}/g, member.current_end_date || member.original_end_date || '');

      const cleanTerms = rawTermsConditions
        .replace(/\{\{guest_name\}\}/g, member.guest_name || 'Member')
        .replace(/\{\{membership_number\}\}/g, member.membership_number || '');

      const startDateFormatted = member.start_date ? format(parseISO(member.start_date), 'dd MMM yyyy') : 'N/A';
      const endDateFormatted = (member.current_end_date || member.original_end_date) ? format(parseISO(member.current_end_date || member.original_end_date), 'dd MMM yyyy') : 'N/A';

      const subject = `Membership Purchase Confirmed - ${member.guest_name} (${member.membership_number})`;
      
      const logoUrl = resolveLogoUrl(outlet, property, settings);

      const html = buildBoxedEmailHtml({
        bannerType: 'success',
        bannerText: 'MEMBERSHIP ENROLLMENT CONFIRMED',
        logoUrl,
        propertyName: property?.name || 'HEALTH CLUB',
        outletName: outlet?.name || 'CLUB',
        subtitle: 'OFFICIAL MEMBERSHIP ENROLLMENT',
        greeting: 'Dear Admin,',
        introParagraph: `A new membership purchase has been completed and registered in the system for <strong>${property?.name || 'HEALTH CLUB'}</strong> (${outlet?.name || 'CLUB'}). Below are the member enrollment details and attached agreement.`,
        calloutBox: pdfBase64 ? `📄 <strong>Official Document Attached:</strong> Your signed Membership Agreement & Facility Rules PDF is attached to this email (Membership_Agreement_${member.membership_number || 'Record'}.pdf).` : undefined,
        dataFields: [
          { label: 'MEMBER NAME', value: member.guest_name || 'N/A' },
          { label: 'MEMBERSHIP NUMBER', value: member.membership_number || 'N/A' },
          { label: 'PACKAGE & ACCESS', value: `${member.package_type || 'Single'} (${member.access_type || 'Both'})` },
          { label: 'ENROLLMENT TYPE', value: member.membership_type || 'New' },
          { label: 'COMMENCEMENT DATE', value: startDateFormatted },
          { label: 'EXPIRY DATE (VALIDITY)', value: endDateFormatted }
        ],
        amountBox: {
          label: 'TOTAL CONTRIBUTION PAID',
          amount: (member.net_amount || 0),
          currency: symbol,
          subtext: `Payment Ref: ${member.check_no || 'Direct Registration'}`
        },
        timestamp: format(new Date(), 'HH:mm:ss dd/MM/yyyy')
      });

      const attachments = pdfBase64 ? [{
        filename: `Membership_Agreement_${member.membership_number || 'Record'}.pdf`,
        content: pdfBase64
      }] : [];

      for (const email of targetEmails) {
        await this.sendEmail(email, subject, html, attachments);
      }
      console.log(`[Email Service] Member purchase notification email sent to: ${targetEmails.join(', ')} with ${attachments.length} attachments.`);
    } catch (err) {
      console.error('[Email Service] Error sending member purchase email:', err);
    }
  },

  async sendMemberExpirationReminderEmail(
    member: Member,
    daysRemaining: number,
    options?: {
      testRecipientEmail?: string;
      overrideOutletConfig?: ExpirationReminderOutletConfig;
      isTest?: boolean;
    }
  ): Promise<{ success: boolean; error?: string; messageId?: string; recipient?: string }> {
    try {
      const outlets = await db.getOutlets();
      const properties = await db.getProperties();
      const settings = await db.getSettings();

      const memberOutlet = outlets.find(o => o.id === member.outlet_id);
      const memberProperty = properties.find(p => p.id === member.property_id || p.id === memberOutlet?.property_id);

      const targetEmail = (options?.testRecipientEmail || member.email || '').trim();
      if (!targetEmail) {
        return { success: false, error: `Member ${member.guest_name} (${member.membership_number}) has no valid email address on file.` };
      }

      const propName = memberProperty?.name || settings?.name || 'Luxury Health Club';
      const outletName = memberOutlet?.name || 'Fitness & Wellness';
      const logoUrl = resolveLogoUrl(memberOutlet, memberProperty, settings);

      const startDateFormatted = member.start_date ? format(parseISO(member.start_date), 'dd MMM yyyy') : undefined;
      const rawEndDate = member.current_end_date || member.original_end_date || '';
      const endDateFormatted = rawEndDate ? format(parseISO(rawEndDate), 'dd MMM yyyy') : 'Upcoming';

      const reminderConfig = await db.getExpirationReminderConfig();
      const outletConfig = options?.overrideOutletConfig || (member.outlet_id ? reminderConfig.outlets?.[member.outlet_id] : undefined);

      const customMessage = outletConfig?.custom_message;
      const phone = outletConfig?.renewal_contact_phone || memberOutlet?.phone || memberProperty?.phone || settings?.phone;
      const renewalEmail = outletConfig?.renewal_contact_email || undefined;
      const address = memberOutlet?.address || memberProperty?.address || settings?.address;

      const html = buildGuestExpirationReminderEmailHtml({
        guestName: member.guest_name,
        memberNumber: member.membership_number,
        membershipType: member.membership_type,
        packageType: member.package_type,
        accessType: member.access_type,
        startDate: startDateFormatted,
        endDate: endDateFormatted,
        daysRemaining,
        propertyName: propName,
        outletName: outletName,
        logoUrl,
        phone,
        address,
        customMessage,
        renewalEmail
      });

      let urgencyPrefix = `Expiring in ${daysRemaining} Days`;
      if (daysRemaining <= 0) urgencyPrefix = 'Expires Today';
      else if (daysRemaining === 1) urgencyPrefix = 'Expires Tomorrow';

      const testPrefix = options?.isTest ? '[TEST REMINDER] ' : '';
      const subject = `${testPrefix}Membership Expiration Notice - ${urgencyPrefix} | ${propName}`;

      const sendResult = await this.sendEmail(targetEmail, subject, html);

      // Log dispatch
      await db.logExpirationReminder({
        member_id: member.id,
        member_name: member.guest_name,
        member_number: member.membership_number,
        recipient_email: targetEmail,
        outlet_id: member.outlet_id || '',
        outlet_name: outletName,
        property_name: propName,
        expiry_date: endDateFormatted,
        days_remaining: daysRemaining,
        sent_at: new Date().toISOString(),
        status: sendResult.success ? 'sent' : 'failed',
        error_message: sendResult.error
      });

      return { ...sendResult, recipient: targetEmail };
    } catch (err: any) {
      console.error('[Email Service] Error in sendMemberExpirationReminderEmail:', err);
      return { success: false, error: err?.message || String(err) };
    }
  },

  async processAutomatedExpirationReminders(options?: {
    forceOutletId?: string;
    forcePropertyId?: string;
    isManualTrigger?: boolean;
  }): Promise<{
    scanned: number;
    eligible: number;
    sent: number;
    failed: number;
    skipped: number;
    details: string[];
  }> {
    const results = {
      scanned: 0,
      eligible: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      details: [] as string[]
    };

    try {
      const config = await db.getExpirationReminderConfig();
      if (!config.global_enabled && !options?.isManualTrigger) {
        results.details.push('Automated expiration reminders are globally disabled in settings.');
        return results;
      }

      const members = await db.getMembers();
      const outlets = await db.getOutlets();
      const properties = await db.getProperties();
      const existingLogs = await db.getExpirationReminderLogs();
      const today = startOfDay(new Date());
      const dateStr = format(today, 'yyyy-MM-dd');

      // Database-backed sent today check
      const sentTodayMap: Record<string, boolean> = {};
      for (const log of existingLogs) {
        if (log.status === 'sent' && log.sent_at) {
          const logDateStr = format(new Date(log.sent_at), 'yyyy-MM-dd');
          if (logDateStr === dateStr) {
            sentTodayMap[`${log.member_id}_${log.days_remaining}_${dateStr}`] = true;
          }
        }
      }

      for (const member of members) {
        results.scanned++;

        // Only active members
        if (member.status !== MemberStatus.ACTIVE) {
          results.skipped++;
          continue;
        }

        // Must belong to an outlet
        const outletId = member.outlet_id;
        if (!outletId) {
          results.skipped++;
          continue;
        }

        const memberOutlet = outlets.find(o => o.id === outletId);

        // Filter by property if specified
        if (options?.forcePropertyId && options.forcePropertyId !== 'all') {
          const memberPropertyId = member.property_id || memberOutlet?.property_id;
          if (memberPropertyId !== options.forcePropertyId) {
            results.skipped++;
            continue;
          }
        }

        if (options?.forceOutletId && options.forceOutletId !== 'all' && outletId !== options.forceOutletId) {
          results.skipped++;
          continue;
        }

        // Check if outlet is allowed to send reminders
        const outletConfig = config.outlets?.[outletId];
        const isOutletAllowed = outletConfig ? outletConfig.enabled : false;
        
        if (!isOutletAllowed && !options?.forceOutletId) {
          results.skipped++;
          continue;
        }

        // Must have an email address
        const memberEmail = (member.email || '').trim();
        if (!memberEmail) {
          results.skipped++;
          continue;
        }

        // Check expiration date
        const rawEndDate = member.current_end_date || member.original_end_date;
        if (!rawEndDate) {
          results.skipped++;
          continue;
        }

        const expiryDate = startOfDay(parseISO(rawEndDate));
        const daysRemaining = differenceInCalendarDays(expiryDate, today);

        // Check if daysRemaining matches outlet's configured milestones
        const allowedDays = (outletConfig?.days_before && outletConfig.days_before.length > 0)
          ? outletConfig.days_before
          : [30, 14, 7, 1];

        if (!allowedDays.includes(daysRemaining)) {
          // Not at an expiration milestone today
          continue;
        }

        // Deduplication check: key = memberId_daysRemaining_date
        const memberKey = `${member.id}_${daysRemaining}_${dateStr}`;
        if (sentTodayMap[memberKey] && !options?.isManualTrigger) {
          // Already sent today
          continue;
        }

        results.eligible++;

        // Send reminder email
        const outletName = outlets.find(o => o.id === outletId)?.name || 'Facility';
        const sendRes = await this.sendMemberExpirationReminderEmail(member, daysRemaining, {
          overrideOutletConfig: outletConfig
        });

        if (sendRes.success) {
          results.sent++;
          sentTodayMap[memberKey] = true;
          results.details.push(`Sent ${daysRemaining}-day reminder to ${member.guest_name} (${memberEmail}) for ${outletName}`);
        } else {
          results.failed++;
          results.details.push(`Failed sending to ${member.guest_name} (${memberEmail}): ${sendRes.error || 'Unknown error'}`);
        }
      }

    } catch (err: any) {
      console.error('[Email Service] Error running processAutomatedExpirationReminders:', err);
      results.details.push(`Critical error: ${err?.message || String(err)}`);
    }

    return results;
  }
};

let lastExpirationCheckHour = -1;

export const schedulerService = {
  async processScheduledReports() {
    const now = new Date();
    const currentTime = format(now, 'HH:mm');
    const currentHour = now.getHours();
    
    try {
      // Run Automated Expiration Reminders check once every hour (or at 09:00 morning)
      if (lastExpirationCheckHour !== currentHour) {
        lastExpirationCheckHour = currentHour;
        emailService.processAutomatedExpirationReminders().catch(err => {
          console.error('[Scheduler] Expiration reminders background error:', err);
        });
      }

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

          // Trigger Headless DOM Renderer for exact PDF matching
          const reportEvent = new CustomEvent('TRIGGER_REPORT_DISPATCH', {
            detail: {
              recipient,
              property,
              outlet,
              date: now,
              isManual: false
            }
          });
          window.dispatchEvent(reportEvent);
        }
      }
    } catch (error) {
      console.error('[Scheduler] Error processing reports:', error);
    }
  }
};
