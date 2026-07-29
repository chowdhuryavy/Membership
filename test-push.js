const webpush = require('web-push');

// Replace these with the actual keys from your environment if possible
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || 'BJ7C_aKVlBqq5c3bKluSbmQQ4DmFQw2SftLT-RzsTr8q31JvyEml9XuS4AZT5Nw68lrUgcW-5ikrjWpIFJR-5uc';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY; // Need to know this to test manually

if (!VAPID_PRIVATE) {
    console.log("No private key available for local testing script.");
}
