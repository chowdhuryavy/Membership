import { JWT } from 'google-auth-library';

function formatPrivateKey(rawKey: string): string {
  if (!rawKey) return '';
  let key = rawKey.trim();

  // Strip leading/trailing quotes if present
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }

  // Convert literal \n sequences to real linebreaks
  key = key.replace(/\\n/g, '\n');

  // Format into standard PEM structure if headers are present
  const headerMatch = key.match(/(-----BEGIN [A-Z ]+-----)/);
  const footerMatch = key.match(/(-----END [A-Z ]+-----)/);

  if (headerMatch && footerMatch) {
    const header = headerMatch[1];
    const footer = footerMatch[1];
    const startIndex = key.indexOf(header) + header.length;
    const endIndex = key.indexOf(footer);
    const rawBody = key.substring(startIndex, endIndex);

    const cleanBody = rawBody.replace(/\s+/g, '');
    const bodyChunks = cleanBody.match(/.{1,64}/g) || [cleanBody];

    return [header, ...bodyChunks, footer].join('\n') + '\n';
  }

  return key;
}

function getGoogleWalletJwtClient() {
  let clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;

  if ((!clientEmail || !privateKey) && credentialsJson) {
    try {
      const creds = JSON.parse(credentialsJson);
      clientEmail = creds.client_email;
      privateKey = creds.private_key;
    } catch (e) {
      console.error('[Google Wallet Sync] Invalid GOOGLE_SERVICE_ACCOUNT_JSON:', e);
    }
  }

  if (!clientEmail || !privateKey || !issuerId) {
    return null;
  }

  privateKey = formatPrivateKey(privateKey);
  if (!privateKey.includes('-----BEGIN')) {
    return null;
  }

  const client = new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/wallet_object.issuer']
  });

  return { client, issuerId };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const {
      memberId,
      guestName,
      membershipNumber,
      propertyName,
      outletName,
      logoUrl,
      packageTier,
      accessType,
      validUntil,
      status
    } = req.body || {};

    if (!memberId) {
      return res.status(400).json({ error: 'Missing memberId' });
    }

    const auth = getGoogleWalletJwtClient();
    if (!auth) {
      console.warn('[Google Wallet Sync] Credentials not fully configured. Skipping pass update.');
      return res.status(500).json({ 
        success: false, 
        error: 'Google Wallet service account credentials are not configured on server environment.' 
      });
    }

    const { client, issuerId } = auth;
    const cleanMemberId = String(memberId).replace(/[^a-zA-Z0-9_]/g, '');
    const objectId = `${issuerId}.mem_${cleanMemberId}`;

    const isFrozen = String(status || '').toLowerCase() === 'frozen';
    const isExpired = String(status || '').toLowerCase() === 'expired';
    const isCancelled = String(status || '').toLowerCase() === 'cancelled';
    const statusEmoji = isFrozen ? '⏸️' : (isExpired || isCancelled) ? '🔴' : '🟢';

    const displayTitle = propertyName
      ? `${propertyName}${outletName ? ' - ' + outletName : ''}`
      : (outletName ? `AL AZIZIYAH BOUTIQUE HOTEL - ${outletName}` : 'AL AZIZIYAH BOUTIQUE HOTEL - NOVA SPA');

    let displayLogo = 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=300&q=80';
    if (logoUrl && typeof logoUrl === 'string' && (logoUrl.startsWith('http://') || logoUrl.startsWith('https://'))) {
      displayLogo = logoUrl;
    }

    const patchPayload = {
      cardTitle: {
        defaultValue: {
          language: 'en-US',
          value: displayTitle
        }
      },
      header: {
        defaultValue: {
          language: 'en-US',
          value: guestName || 'Member'
        }
      },
      subheader: {
        defaultValue: {
          language: 'en-US',
          value: `Member #${membershipNumber || memberId}`
        }
      },
      barcode: {
        type: 'QR_CODE',
        value: String(membershipNumber || memberId),
        alternateText: `#${membershipNumber || memberId}`
      },
      logo: {
        sourceUri: {
          uri: displayLogo
        },
        contentDescription: {
          defaultValue: {
            language: 'en-US',
            value: `${propertyName || 'Health Club'} Logo`
          }
        }
      },
      textModulesData: [
        {
          id: 'property_outlet',
          header: '🏨 LOCATION / OUTLET',
          body: displayTitle
        },
        {
          id: 'member_no',
          header: '🆔 MEMBER #',
          body: `#${membershipNumber || memberId}`
        },
        {
          id: 'package_tier',
          header: '🌟 PACKAGE TIER',
          body: packageTier || '1 Month Couple Pool Membership'
        },
        {
          id: 'access_permit',
          header: '🔑 ACCESS PERMIT',
          body: accessType || 'Both'
        },
        {
          id: 'valid_until',
          header: '📅 VALID UNTIL',
          body: validUntil || 'N/A'
        },
        {
          id: 'card_status',
          header: `${statusEmoji} STATUS`,
          body: String(status || 'Active').toUpperCase()
        }
      ]
    };

    console.log(`[Google Wallet Sync] Sending PATCH to object ${objectId}...`);

    const googleRes = await client.request({
      url: `https://walletobjects.googleapis.com/walletobjects/v1/genericObject/${objectId}`,
      method: 'PATCH',
      data: patchPayload
    });

    console.log(`[Google Wallet Sync Success] Object ${objectId} updated successfully. Status: ${googleRes.status}`);
    return res.status(200).json({ success: true, objectId, status: googleRes.status });

  } catch (err: any) {
    const errorStatus = err?.response?.status || 500;
    const errorData = err?.response?.data || err?.message || err;

    console.error(`[Google Wallet Sync Error] Pass sync failed for member ${req.body?.memberId}:`, errorData);

    return res.status(errorStatus < 600 ? errorStatus : 500).json({
      success: false,
      objectId: `${process.env.GOOGLE_WALLET_ISSUER_ID}.mem_${String(req.body?.memberId || '').replace(/[^a-zA-Z0-9_]/g, '')}`,
      status: errorStatus,
      error: typeof errorData === 'object' ? JSON.stringify(errorData) : String(errorData)
    });
  }
}
