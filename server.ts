import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import jwt from 'jsonwebtoken';
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
      console.error('[Google Wallet] Invalid GOOGLE_SERVICE_ACCOUNT_JSON:', e);
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

  return { client, issuerId, clientEmail, privateKey };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Google Wallet API Route
  app.post('/api/google-wallet/generate-link', (req, res) => {
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

      // Check for environment variables
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

      // Auto-generate a class ID if the user hasn't provided one
      const classId = process.env.GOOGLE_WALLET_CLASS_ID || `${issuerId}.hotel_spa_member_v12`;

      if (!/^\d+$/.test(issuerId)) {
        return res.status(500).json({ 
          error: `GOOGLE_WALLET_ISSUER_ID must be a numeric value (e.g., 33880000000...). You provided: ${issuerId}. The Merchant ID is NOT the Issuer ID.` 
        });
      }

      const displayTitle = propertyName 
        ? `${propertyName}${outletName ? ' - ' + outletName : ''}` 
        : (outletName ? outletName : 'Member Pass');

      // Define the Generic Object with deterministic ID mapping per member
      const cleanMemberId = String(memberId || '101').replace(/[^a-zA-Z0-9_]/g, '');
      const objectId = `${issuerId}.mem_${cleanMemberId}`;

      // Ensure logo URL is valid HTTP/HTTPS and usable by Google Wallet API
      let displayLogo = '';
      if (logoUrl && typeof logoUrl === 'string' && (logoUrl.startsWith('http://') || logoUrl.startsWith('https://'))) {
        displayLogo = logoUrl;
      }

      console.log('Generating Google Wallet Link:', { displayTitle, displayLogo, logoUrl });

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
                        { fieldPath: "object.textModulesData['property_outlet']" }
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
              },
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
                        { fieldPath: "object.textModulesData['valid_until']" }
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
          value: membershipNumber || memberId,
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

      // Create the JWT claims payload
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

      // Sign the JWT with the service account private key
      const token = jwt.sign(claims, privateKey, { algorithm: 'RS256' });
      
      // Generate the "Save to Google Wallet" URL
      const saveUrl = `https://pay.google.com/gp/v/save/${token}`;

      res.json({ url: saveUrl });
    } catch (error: any) {
      console.error('Error generating Google Wallet link:', error);
      res.status(500).json({ error: error?.message || 'Failed to generate pass' });
    }
  });

  // Google Wallet Pass Automatic Synchronization Route (PATCH)
  app.post('/api/google-wallet/sync-pass', async (req, res) => {
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

      if (!memberId) {
        return res.status(400).json({ error: 'Missing memberId' });
      }

      const auth = getGoogleWalletJwtClient();
      if (!auth) {
        console.warn('[Google Wallet Sync] Credentials not fully configured. Skipping pass update.');
        return res.json({ success: false, reason: 'Credentials not configured' });
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
        : (outletName ? outletName : 'Member Pass');

      let displayLogo = '';
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
      return res.json({ success: true, objectId, status: googleRes.status });

    } catch (err: any) {
      const errorStatus = err?.response?.status;
      const errorData = err?.response?.data || err?.message || err;

      if (errorStatus === 404) {
        console.log(`[Google Wallet Sync] Pass object mem_${req.body?.memberId} not found in Google Wallet (pass not yet added to device).`);
      } else {
        console.warn(`[Google Wallet Sync] Automatic Google Wallet pass update for member ${req.body?.memberId} (status ${errorStatus}):`, errorData?.error?.message || errorData?.message || errorData);
      }

      return res.json({
        success: false,
        objectId: `${process.env.GOOGLE_WALLET_ISSUER_ID}.mem_${String(req.body?.memberId || '').replace(/[^a-zA-Z0-9_]/g, '')}`,
        status: errorStatus,
        details: typeof errorData === 'object' ? JSON.stringify(errorData) : String(errorData)
      });
    }
  });

  // Resend Direct Email Endpoint
  app.post('/api/send-email', async (req, res) => {
    try {
      const { to, subject, html, attachments } = req.body;
      const resendApiKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;

      if (!resendApiKey) {
        console.warn('[Express /api/send-email] RESEND_API_KEY not configured on server. Returning 401 for diagnostic visibility.');
        return res.status(401).json({ 
          success: false, 
          fallback: true,
          error: 'RESEND_API_KEY is missing from environment. Please add it to your project settings.',
          configRequired: true 
        });
      }

      const rawToList = Array.isArray(to) ? to : [to];
      const emails = rawToList
        .flatMap((e: string) => (typeof e === 'string' ? e.split(',') : [e]))
        .map((e: string) => (typeof e === 'string' ? e.trim() : ''))
        .filter(Boolean);

      if (emails.length === 0) {
        return res.status(400).json({ success: false, error: 'No recipient email addresses provided' });
      }

      const fromEmail = process.env.EMAIL_FROM || 'noreply@perfection.my';
      const appName = 'Health Club Management';

      const text = (html || '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<tr[^>]*>/gi, '\n')
        .replace(/<td[^>]*>/gi, '  ')
        .replace(/<p[^>]*>/gi, '\n\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&bull;/g, '•')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim();

      console.log(`[Express /api/send-email] Dispatching email to ${emails.join(', ')} (from: ${fromEmail})...`);

      const deliveryResults = await Promise.allSettled(
        emails.map(async (recipientEmail) => {
          const deliverabilityHeaders = {
            'X-Entity-Ref-ID': Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9),
            'Auto-Submitted': 'auto-generated',
            'X-Auto-Response-Suppress': 'OOF, AutoReply',
            'List-Unsubscribe': `<mailto:${fromEmail}?subject=unsubscribe>`
          };

          // Attempt 1: Send via configured fromEmail
          let resp = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: `${appName} <${fromEmail}>`,
              reply_to: fromEmail,
              to: [recipientEmail],
              subject,
              html,
              text,
              headers: deliverabilityHeaders,
              attachments: attachments || []
            })
          });

          let result: any = await resp.json().catch(() => ({}));

          // Fallback to onboarding@resend.dev if domain unverified
          if (!resp.ok && fromEmail !== 'onboarding@resend.dev') {
            console.warn(`[Express /api/send-email] First attempt for ${recipientEmail} with ${fromEmail} failed:`, result, '. Retrying with onboarding@resend.dev...');
            resp = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                from: `${appName} <onboarding@resend.dev>`,
                reply_to: fromEmail, // Keep original support email as reply_to to avoid domain mismatch
                to: [recipientEmail],
                subject,
                html,
                text,
                headers: deliverabilityHeaders,
                attachments: attachments || []
              })
            });
            result = await resp.json().catch(() => ({}));
          }

          if (!resp.ok) {
            const msg = result.message || JSON.stringify(result);
            throw new Error(`[${recipientEmail}] ${msg}`);
          }

          return { email: recipientEmail, id: result.id };
        })
      );

      const successful = deliveryResults
        .filter((r): r is PromiseFulfilledResult<{ email: string; id: string }> => r.status === 'fulfilled')
        .map(r => r.value);

      const failed = deliveryResults
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map(r => r.reason?.message || 'Unknown error');

      console.log(`[Express /api/send-email] Dispatch summary: ${successful.length} delivered, ${failed.length} failed.`, { successful, failed });

      if (successful.length > 0) {
        return res.json({
          success: true,
          id: successful[0].id,
          deliveredTo: successful.map(s => s.email),
          failedCount: failed.length,
          errors: failed.length > 0 ? failed : undefined
        });
      } else {
        const errorMsg = failed.join('; ') || 'Failed to deliver email to recipients';
        return res.status(400).json({ success: false, error: errorMsg });
      }
    } catch (err: any) {
      console.error('[Express /api/send-email] Exception:', err);
      return res.status(500).json({ success: false, error: err?.message || String(err) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static file serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
