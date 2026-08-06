import JSZip from 'jszip';
import { Member } from '../types';

export function detectDeviceOS(): 'ios' | 'android' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) {
    return 'ios';
  }
  if (/mac/i.test(ua) && navigator.maxTouchPoints && navigator.maxTouchPoints > 2) {
    return 'ios'; // iPadOS 13+
  }
  if (/android/i.test(ua)) {
    return 'android';
  }
  return 'desktop';
}

// SHA-1 helper for manifest.json
async function sha1Hex(strOrBuffer: string | Uint8Array): Promise<string> {
  const encoder = new TextEncoder();
  const data = typeof strOrBuffer === 'string' ? encoder.encode(strOrBuffer) : strOrBuffer;
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 29x29 solid/transparent base64 PNG image for Apple Wallet icons
const BASE64_PNG_ICON = 'iVBORw0KGgoAAAANSUhEUgAAAB0AAAAdCAYAAAB5eP0AAABMSURBVEjH7c0xAQAACAMg+1f2G4O1gQA2k4S0O/u8Xq/X6/V6vV6v1+v1er1er9fr9Xq9Xq/X6/V6v1+v1+v1er1er9fr9fp/3g38B310AAAAAElFTkSuQmCC';

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function createPkpassZipBlob(member: Member, outletName?: string, address?: string, phone?: string): Promise<Blob> {
  const zip = new JSZip();

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: 'pass.com.healthclub.membership',
    serialNumber: String(member.membership_number || member.id),
    teamIdentifier: 'HC99823412',
    organizationName: outletName || 'Health Club & Spa',
    description: 'Digital Membership Access Card',
    logoText: outletName || 'HEALTH CLUB MEMBER',
    foregroundColor: 'rgb(255, 255, 255)',
    backgroundColor: 'rgb(15, 23, 42)',
    labelColor: 'rgb(148, 163, 184)',
    generic: {
      primaryFields: [
        {
          key: 'guestName',
          label: 'MEMBER NAME',
          value: member.guest_name || 'Member'
        }
      ],
      secondaryFields: [
        {
          key: 'memberNo',
          label: 'MEMBERSHIP #',
          value: String(member.membership_number || member.id)
        },
        {
          key: 'access',
          label: 'ACCESS TYPE',
          value: member.access_type || 'Pool & Spa'
        }
      ],
      auxiliaryFields: [
        {
          key: 'status',
          label: 'STATUS',
          value: (member.status || 'Active').toUpperCase()
        },
        {
          key: 'validUntil',
          label: 'VALID UNTIL',
          value: member.current_end_date || 'N/A'
        }
      ],
      backFields: [
        {
          key: 'terms',
          label: 'TERMS & CONDITIONS',
          value: 'This digital card is personal and non-transferable. Scan at reception/turnstile for entry access.'
        },
        {
          key: 'address',
          label: 'ADDRESS',
          value: address || 'Aspire Zone, Al Waab Street, Doha, Qatar'
        },
        {
          key: 'phone',
          label: 'PHONE',
          value: phone || '+974 4446 5600'
        }
      ]
    },
    barcodes: [
      {
        message: String(member.membership_number || member.id),
        format: 'PKBarcodeFormatQR',
        messageEncoding: 'iso-8859-1',
        altText: String(member.membership_number || member.id)
      }
    ],
    barcode: {
      message: String(member.membership_number || member.id),
      format: 'PKBarcodeFormatQR',
      messageEncoding: 'iso-8859-1',
      altText: String(member.membership_number || member.id)
    }
  };

  const passJsonString = JSON.stringify(passJson, null, 2);
  const iconBytes = base64ToUint8Array(BASE64_PNG_ICON);

  zip.file('pass.json', passJsonString);
  zip.file('icon.png', iconBytes);
  zip.file('icon@2x.png', iconBytes);
  zip.file('logo.png', iconBytes);
  zip.file('logo@2x.png', iconBytes);

  const manifest: Record<string, string> = {
    'pass.json': await sha1Hex(passJsonString),
    'icon.png': await sha1Hex(iconBytes),
    'icon@2x.png': await sha1Hex(iconBytes),
    'logo.png': await sha1Hex(iconBytes),
    'logo@2x.png': await sha1Hex(iconBytes)
  };

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.apple.pkpass',
    compression: 'DEFLATE'
  });

  return blob;
}

export function generateGoogleWalletSaveUrl(member: Member, outletName?: string): string {
  const memberId = member.membership_number || member.id;
  const name = encodeURIComponent(member.guest_name || 'Member');
  const issuer = encodeURIComponent(outletName || 'Health Club');
  return `https://pay.google.com/gp/v/save/pass?id=${memberId}&title=${name}&issuer=${issuer}`;
}
