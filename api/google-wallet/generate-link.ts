import jwt from 'jsonwebtoken';

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

export default function handler(req: any, res: any) {
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
    } = req.body;

    if (!memberId || !guestName) {
      return res.status(400).json({ error: 'Missing member details' });
    }

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
        return res.status(500).json({ error: 'Invalid Google Service Account JSON format.' });
      }
    }

    if (!clientEmail || !privateKey || !issuerId) {
      return res.status(500).json({ 
        error: 'Google Wallet credentials (GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, and GOOGLE_WALLET_ISSUER_ID) not configured on the server. Please check your environment variables.' 
      });
    }

    // Format and validate private key for RS256 signing
    privateKey = formatPrivateKey(privateKey);
    if (!privateKey.includes('-----BEGIN')) {
      return res.status(500).json({ 
        error: 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY is missing valid RSA PEM headers ("-----BEGIN PRIVATE KEY-----"). Please copy the full private key from your service account credentials.' 
      });
    }

    const classId = process.env.GOOGLE_WALLET_CLASS_ID || `${issuerId}.hotel_spa_member_v12`;

    if (!/^\d+$/.test(issuerId)) {
      return res.status(500).json({ 
        error: `GOOGLE_WALLET_ISSUER_ID must be a numeric value (e.g., 33880000000...). You provided: ${issuerId}. The Merchant ID is NOT the Issuer ID.` 
      });
    }

    const cleanMemberId = String(memberId || '101').replace(/[^a-zA-Z0-9_]/g, '');
    const objectId = `${issuerId}.mem_${cleanMemberId}`;
    
    const displayTitle = propertyName 
      ? `${propertyName}${outletName ? ' - ' + outletName : ''}` 
      : (outletName ? outletName : 'Member Pass');

    // Ensure logo URL is valid HTTP/HTTPS and usable by Google Wallet API
    let displayLogo = '';
    if (logoUrl && typeof logoUrl === 'string' && (logoUrl.startsWith('http://') || logoUrl.startsWith('https://'))) {
      displayLogo = logoUrl;
    }

    const isFrozen = String(status || '').toLowerCase() === 'frozen';
    const isExpired = String(status || '').toLowerCase() === 'expired';
    const statusEmoji = isFrozen ? '⏸️' : isExpired ? '🔴' : '🟢';

    const genericClass = {
      id: classId,
      issuerName: displayTitle,
      reviewStatus: 'UNDER_REVIEW',
      classTemplateInfo: {
        cardTemplateOverride: {
          cardRowTemplateInfos: [
            {
              twoItems: {
                startItem: {
                  firstValue: {
                    fields: [
                      { fieldPath: "object.textModulesData['package_tier']" }
                    ]
                  }
                },
                endItem: {
                  firstValue: {
                    fields: [
                      { fieldPath: "object.textModulesData['access_permit']" }
                    ]
                  }
                }
              }
            },
            {
              twoItems: {
                startItem: {
                  firstValue: {
                    fields: [
                      { fieldPath: "object.textModulesData['valid_until']" }
                    ]
                  }
                },
                endItem: {
                  firstValue: {
                    fields: [
                      { fieldPath: "object.textModulesData['card_status']" }
                    ]
                  }
                }
              }
            }
          ]
        }
      }
    };

    const genericObject = {
      id: objectId,
      classId: classId,
      genericType: 'GENERIC_TYPE_UNSPECIFIED',
      hexBackgroundColor: '#070c18',
      logo: {
        sourceUri: {
          uri: displayLogo
        },
        contentDescription: {
          defaultValue: {
            language: 'en-US',
            value: `${propertyName || 'Property'} Logo`
          }
        }
      },
      cardTitle: {
        defaultValue: {
          language: 'en-US',
          value: displayTitle
        }
      },
      header: {
        defaultValue: {
          language: 'en-US',
          value: guestName
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
        value: membershipNumber || memberId,
        alternateText: `#${membershipNumber || memberId}`
      },
      textModulesData: [
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
          body: validUntil || '2026-09-04'
        },
        {
          id: 'card_status',
          header: `${statusEmoji} STATUS`,
          body: (status || 'Active').toUpperCase()
        }
      ]
    };

    const claims = {
      iss: clientEmail,
      aud: 'google',
      typ: 'savetowallet',
      iat: Math.floor(Date.now() / 1000),
      origins: [],
      payload: {
        genericClasses: [genericClass],
        genericObjects: [genericObject]
      }
    };

    const token = jwt.sign(claims, privateKey, { algorithm: 'RS256' });
    const saveUrl = `https://pay.google.com/gp/v/save/${token}`;

    res.json({ url: saveUrl });
  } catch (error: any) {
    console.error('Error generating Google Wallet link:', error);
    res.status(500).json({ error: error?.message || 'Failed to generate pass' });
  }
}
