import jwt from 'jsonwebtoken';

export default function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { memberId, guestName, membershipNumber } = req.body;

    if (!memberId || !guestName) {
      return res.status(400).json({ error: 'Missing member details' });
    }

    const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
    
    const classId = process.env.GOOGLE_WALLET_CLASS_ID || `${issuerId}.health_club_member_class_v1`;

    if (!credentialsJson || !issuerId) {
      return res.status(500).json({ 
        error: 'Google Wallet credentials (Service Account JSON and Issuer ID) not configured on the server. Please add them in the Settings.' 
      });
    }

    if (!/^\d+$/.test(issuerId)) {
      return res.status(500).json({ 
        error: `GOOGLE_WALLET_ISSUER_ID must be a numeric value (e.g., 33880000000...). You provided: ${issuerId}. The Merchant ID is NOT the Issuer ID.` 
      });
    }

    let credentials;
    try {
      credentials = JSON.parse(credentialsJson);
    } catch (e) {
      return res.status(500).json({ error: 'Invalid Google Service Account JSON format.' });
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
      iss: credentials.client_email,
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

    const token = jwt.sign(claims, credentials.private_key, { algorithm: 'RS256' });
    const saveUrl = `https://pay.google.com/gp/v/save/jwt?jwt=${token}`;

    res.json({ url: saveUrl });
  } catch (error) {
    console.error('Error generating Google Wallet link:', error);
    res.status(500).json({ error: 'Failed to generate pass' });
  }
}
