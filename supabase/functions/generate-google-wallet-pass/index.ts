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
    const { memberId, guestName, membershipNumber } = await req.json();

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

    const classId = Deno.env.get('GOOGLE_WALLET_CLASS_ID') || `${issuerId}.health_club_member_class_v1`;
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
