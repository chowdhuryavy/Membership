import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import jwt from "npm:jsonwebtoken";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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
    } = await req.json();

    if (!memberId || !guestName) {
      return new Response(JSON.stringify({ error: 'Missing member details' }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const credentialsJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT') || Deno.env.get('GOIGLE_SERVICE_ACCOUNT') || Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
    const issuerId = Deno.env.get('GOOGLE_WALLET_ISSUER_ID');

    if (!credentialsJson || !issuerId) {
      return new Response(JSON.stringify({ 
        error: 'Google Wallet credentials not configured on the server. Please add them in Supabase Secrets.' 
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let credentials;
    try {
      credentials = JSON.parse(credentialsJson);
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid Google Service Account JSON format in Secrets.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const classId = Deno.env.get('GOOGLE_WALLET_CLASS_ID') || `${issuerId}.hotel_spa_member_v12`;
    const cleanMemberId = String(memberId).replace(/[^a-zA-Z0-9_]/g, '');
    const objectId = `${issuerId}.mem_${cleanMemberId}`;

    const displayTitle = propertyName 
      ? `${propertyName}${outletName ? ' - ' + outletName : ''}` 
      : (outletName ? outletName : 'Member Pass');

    let displayLogo = '';
    if (logoUrl && typeof logoUrl === 'string' && (logoUrl.startsWith('http://') || logoUrl.startsWith('https://'))) {
      displayLogo = logoUrl;
    }

    const isFrozen = String(status || '').toLowerCase() === 'frozen';
    const isExpired = String(status || '').toLowerCase() === 'expired';
    const statusEmoji = isFrozen ? '⏸️' : isExpired ? '🔴' : '🟢';

    const genericObject = {
      id: objectId,
      classId: classId,
      genericType: 'GENERIC_TYPE_UNSPECIFIED',
      hexBackgroundColor: '#080d1a',
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
        value: String(membershipNumber || memberId),
        alternateText: `#${membershipNumber || memberId}`
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
          id: 'valid_until',
          header: '📅 VALID UNTIL',
          body: validUntil || 'N/A'
        },
        {
          id: 'card_status',
          header: `${statusEmoji} STATUS`,
          body: String(status || 'Active').toUpperCase()
        },
        {
          id: 'rules_info',
          header: '📋 RULES & INFO',
          body: '• This card is personal and strictly non-transferable.\n• Must be scanned at facility self-kiosk or turnstiles upon every entry.\n• Grants access to authorized facility zones according to membership package.\n• Report lost or damaged membership passes to reception immediately.'
        },
        {
          id: 'location_contact',
          header: '📍 LOCATION & CONTACT',
          body: 'Aspire Zone, Al Waab Street, Doha\nTel: +974 4446 5600'
        }
      ],
      messages: [
        {
          header: 'THE TORCH DOHA RULES & INFO',
          body: '• This card is personal and strictly non-transferable.\n• Must be scanned at facility self-kiosk or turnstiles upon every entry.\n• Grants access to authorized facility zones according to membership package.\n• Report lost or damaged membership passes to reception immediately.'
        },
        {
          header: 'LOCATION & CONTACT',
          body: 'Aspire Zone, Al Waab Street, Doha\nTel: +974 4446 5600'
        }
      ],
      infoModuleData: {
        labelValueRows: [
          {
            columns: [
              {
                label: 'RULES & INFO',
                value: '• Personal & non-transferable\n• Scan at self-kiosk or turnstiles\n• Report lost/damaged passes immediately'
              },
              {
                label: 'LOCATION & CONTACT',
                value: 'Aspire Zone, Al Waab Street, Doha\nTel: +974 4446 5600'
              }
            ]
          }
        ]
      }
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
                            { fieldPath: 'object.textModulesData["property_outlet"]' }
                          ]
                        }
                      },
                      endItem: {
                        firstValue: {
                          fields: [
                            { fieldPath: 'object.textModulesData["card_status"]' }
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
                            { fieldPath: 'object.textModulesData["package_tier"]' }
                          ]
                        }
                      },
                      endItem: {
                        firstValue: {
                          fields: [
                            { fieldPath: 'object.textModulesData["valid_until"]' }
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

    return new Response(JSON.stringify({ url: saveUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error generating Google Wallet link:', error);
    return new Response(JSON.stringify({ error: 'Failed to generate pass: ' + error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
