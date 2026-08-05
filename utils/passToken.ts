export interface PassTokenData {
  memberId: string;
  membershipNumber: string;
  issuedAt: number; // ms
  expiresAt: number; // ms
}

export function generatePassToken(memberId: string, membershipNumber: string): string {
  const now = Date.now();
  // Set validity to 24 hours so scanned links remain active for guest's session
  const expiresAt = now + 24 * 60 * 60 * 1000;
  // Compact format: memberId~membershipNumber~expiresAt~issuedAt
  const rawStr = `${memberId}~${membershipNumber}~${expiresAt}~${now}`;
  // Standard base64 with URL safety
  return btoa(rawStr).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodePassToken(token: string): PassTokenData | null {
  if (!token) return null;
  try {
    // Restore base64 standard characters
    let base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }

    const decodedStr = atob(base64);

    // Check if it's the compact format (contains '~')
    if (decodedStr.includes('~')) {
      const parts = decodedStr.split('~');
      if (parts.length >= 3) {
        return {
          memberId: parts[0],
          membershipNumber: parts[1],
          expiresAt: parseInt(parts[2], 10),
          issuedAt: parts[3] ? parseInt(parts[3], 10) : Date.now()
        };
      }
    }

    // Fallback try JSON format
    const jsonStr = decodeURIComponent(decodedStr);
    const data = JSON.parse(jsonStr) as PassTokenData;
    if (data && data.memberId && data.expiresAt) {
      return data;
    }
    return null;
  } catch (e) {
    return null;
  }
}

export function getPublicPassUrl(token: string): string {
  if (typeof window === 'undefined') return '';

  let origin = window.location.origin;

  // Mobile camera apps (iOS / Android) require a public HTTPS web URL.
  // If running on localhost / 127.0.0.1 inside the dev container iframe,
  // substitute the public Cloud Run application URL.
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    origin = 'https://ais-dev-mpohyasvfiv7e5djhwqyi7-54586722583.europe-west2.run.app';
  }

  const cleanPath = window.location.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '');
  
  // Clean standard HTTPS hash URL: https://.../#/pass?token=...
  return `${origin}${cleanPath}/#/pass?token=${token}`;
}

export function parseScannedMemberCode(scannedCode: string, members: any[]): any | undefined {
  if (!scannedCode || !members || members.length === 0) return undefined;
  const clean = scannedCode.trim();

  // 1. Direct match by membership_number, phone, or id
  let matched = members.find(
    m => m.membership_number?.toLowerCase() === clean.toLowerCase() ||
         (m.phone && m.phone.includes(clean)) ||
         m.id === clean
  );
  if (matched) return matched;

  // 2. Extract token from URL if scannedCode is a URL or contains token parameter
  let tokenStr = clean;
  if (clean.includes('token=')) {
    try {
      const urlObj = new URL(clean.startsWith('http') ? clean : `https://dummy.com/${clean}`);
      const param = urlObj.searchParams.get('token') || urlObj.searchParams.get('passToken');
      if (param) tokenStr = param;
    } catch {
      const match = clean.match(/[?&](?:token|passToken)=([^&#]+)/);
      if (match) tokenStr = match[1];
    }
  }

  // 3. Try decoding as PassToken
  const decoded = decodePassToken(tokenStr);
  if (decoded) {
    matched = members.find(
      m => m.id === decoded.memberId ||
           (m.membership_number && m.membership_number.toLowerCase() === decoded.membershipNumber.toLowerCase())
    );
    if (matched) return matched;
  }

  return undefined;
}

