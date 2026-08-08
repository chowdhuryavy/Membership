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
    const { memberId, guestName, membershipNumber } = req.body;

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

    const classId = process.env.GOOGLE_WALLET_CLASS_ID || `${issuerId}.health_club_member_class_v1`;

    if (!/^\d+$/.test(issuerId)) {
      return res.status(500).json({ 
        error: `GOOGLE_WALLET_ISSUER_ID must be a numeric value (e.g., 33880000000...). You provided: ${issuerId}. The Merchant ID is NOT the Issuer ID.` 
      });
    }

    const objectId = `${issuerId}.${memberId.replace(/[^a-zA-Z0-9]/g, '')}`;
    
    const genericObject = {
      id: objectId,
      classId: classId,
      genericType: 'GENERIC_TYPE_UNSPECIFIED',
      hexBackgroundColor: '#0f172a',
      logo: {
        sourceUri: {
          uri: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=150&q=80'
        }
      },
      cardTitle: {
        defaultValue: {
          language: 'en-US',
          value: 'Health Club Member'
        }
      },
      header: {
        defaultValue: {
          language: 'en-US',
          value: guestName
        }
      },
      barcode: {
        type: 'QR_CODE',
        value: membershipNumber || memberId,
        alternateText: membershipNumber || memberId
      },
      textModulesData: [
        {
          id: 'member_no',
          header: 'Membership #',
          body: membershipNumber || memberId
        }
      ]
    };

    const claims = {
      iss: clientEmail,
      aud: 'google',
      typ: 'savetowallet',
      origins: [],
      payload: {
        genericClasses: [
          {
            id: classId,
            issuerName: 'Health Club',
            classTemplateInfo: {
              cardTemplateOverride: {
                cardRowTemplateInfos: [
                  {
                    twoItems: {
                      startItem: {
                        firstValue: {
                          fields: [
                            {
                              fieldPath: 'object.textModulesData["member_no"]'
                            }
                          ]
                        }
                      }
                    }
                  }
                ]
              }
            }
          }
        ],
        genericObjects: [genericObject]
      }
    };

    const token = jwt.sign(claims, privateKey, { algorithm: 'RS256' });
    const saveUrl = `https://pay.google.com/gp/v/save/jwt?jwt=${token}`;

    res.json({ url: saveUrl });
  } catch (error: any) {
    console.error('Error generating Google Wallet link:', error);
    res.status(500).json({ error: error?.message || 'Failed to generate pass' });
  }
}
