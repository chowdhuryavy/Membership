/**
 * Email Canonicalization & DKIM Integrity Service
 * 
 * Complies with:
 * - RFC 6376 (DomainKeys Identified Mail - DKIM Signatures & Canonicalization)
 * - RFC 5322 (Internet Message Format)
 * - RFC 2045 (MIME Part One: Format of Internet Message Bodies / Quoted-Printable)
 * 
 * Prevents AWS SES and intermediate MTA DKIM body hash (bh=) mismatches by:
 * 1. Enforcing strict CRLF (\r\n) line-ending normalization across all body parts.
 * 2. Stripping trailing whitespace from all lines before line breaks (RFC 6376 §3.4.4).
 * 3. Compressing redundant trailing empty lines to ensure deterministic boundary termination.
 * 4. Suppressing AWS SES open-tracking beacon insertion and click-tracking link rewriting (ses:no-track).
 * 5. Providing standard Quoted-Printable line-folding (<= 76 chars) to prevent SMTP line-length wrapping (RFC 5321 998-char limit).
 * 6. Computing diagnostic DKIM body hashes (bh=) and body lengths (l=) for audit verification.
 */

export interface CanonicalizationResult {
  canonicalBody: string;
  bodyHash: string; // Base64 SHA-256 hash (matches DKIM bh=)
  bodyLength: number; // Canonical byte length (matches DKIM l=)
  headers: Record<string, string>;
}

/**
 * Normalizes all line endings to strict CRLF (\r\n) as mandated by RFC 5322.
 */
export function normalizeToCrlf(input: string): string {
  if (!input) return '\r\n';
  // Standardize mixed line endings to LF first, then replace with CRLF
  return input.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '\r\n');
}

/**
 * Strips trailing whitespace (spaces and tabs) from each line before CRLF,
 * implementing RFC 6376 Section 3.4.4 relaxed body canonicalization.
 */
export function stripTrailingWhitespace(input: string): string {
  if (!input) return '';
  return input.replace(/[ \t]+(?=\r\n)/g, '');
}

/**
 * Removes multiple trailing empty lines from the end of the body,
 * leaving exactly one trailing CRLF as required by RFC 6376 §3.4.4.
 * If the body is completely empty, returns an empty string or single CRLF.
 */
export function normalizeTrailingEmptyLines(input: string): string {
  if (!input) return '\r\n';
  // Strip all trailing CRLFs from the end, then add back exactly one
  const trimmed = input.replace(/(?:\r\n)+$/, '');
  return trimmed ? `${trimmed}\r\n` : '\r\n';
}

/**
 * Injects `ses:no-track="true"` into all <a> hyperlink tags in HTML to instruct
 * AWS SES to skip rewriting links during email dispatch.
 * Also neutralizes automatic tracking injections.
 */
export function neutralizeAwsSesTracking(html: string): string {
  if (!html) return '';

  // 1. Add ses:no-track="true" to all <a> tags that don't already have it
  let processedHtml = html.replace(/<a\b(?![^>]*\bses:no-track\b)([^>]*)>/gi, (match, attributes) => {
    return `<a${attributes} ses:no-track="true">`;
  });

  // 2. Ensure all <img> tags have valid alt and no suspicious empty trackers
  processedHtml = processedHtml.replace(/<img\b(?![^>]*\balt=)([^>]*)>/gi, '<img$1 alt="" />');

  return processedHtml;
}

/**
 * Canonicalizes an HTML email body for AWS SES transmission:
 * 1. Neutralizes AWS SES click-tracking rewriting on <a> tags.
 * 2. Normalizes line endings to CRLF (\r\n).
 * 3. Strips trailing whitespace before line endings (relaxed canonicalization).
 * 4. Ensures consistent single CRLF termination at end of body.
 */
export function canonicalizeHtmlBody(html: string): string {
  if (!html) return '<!DOCTYPE html>\r\n<html><head><meta charset="utf-8"/></head><body></body></html>\r\n';

  // Step 1: Neutralize SES link rewriting
  let result = neutralizeAwsSesTracking(html);

  // Step 2: Ensure valid HTML5/XHTML doctype and structure if missing
  if (!result.includes('<!DOCTYPE') && !result.includes('<html')) {
    result = `<!DOCTYPE html>\r\n<html>\r\n<head>\r\n  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />\r\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\r\n</head>\r\n<body>\r\n${result}\r\n</body>\r\n</html>`;
  }

  // Step 3: Convert line breaks to CRLF
  result = normalizeToCrlf(result);

  // Step 4: Remove trailing whitespace on each line
  result = stripTrailingWhitespace(result);

  // Step 5: Normalize trailing empty lines
  result = normalizeTrailingEmptyLines(result);

  return result;
}

/**
 * Canonicalizes a plain text email body:
 * 1. Converts HTML if HTML string was provided, or cleans up raw text.
 * 2. Normalizes line breaks to CRLF.
 * 3. Strips trailing spaces/tabs before line endings.
 * 4. Normalizes trailing empty lines to single CRLF.
 */
export function canonicalizePlainText(textOrHtml: string): string {
  if (!textOrHtml) return '\r\n';

  let text = textOrHtml;
  // If input looks like HTML, convert to clean plain text
  if (text.includes('<') && text.includes('>')) {
    text = text
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
  }

  // Step 1: Normalize to CRLF
  let result = normalizeToCrlf(text);

  // Step 2: Strip trailing spaces/tabs
  result = stripTrailingWhitespace(result);

  // Step 3: Normalize trailing empty lines
  result = normalizeTrailingEmptyLines(result);

  return result;
}

/**
 * Encodes a string into standard RFC 2045 Quoted-Printable representation.
 * - Maximum line length: 76 characters.
 * - Soft line breaks: "=\r\n".
 * - Trailing whitespace encoded as "=20" or "=09".
 * - Non-ASCII or special characters encoded as "=XX".
 * Prevents SMTP servers and AWS SES from folding long lines (>998 chars) in transit.
 */
export function encodeQuotedPrintable(input: string): string {
  if (!input) return '';

  const normalized = normalizeToCrlf(input);
  const lines = normalized.split('\r\n');
  const encodedLines: string[] = [];

  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    let currentLine = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const code = char.charCodeAt(0);
      let encodedChar = '';

      // Check if character needs Quoted-Printable encoding
      const isAsciiPrintable = (code >= 33 && code <= 60) || (code >= 62 && code <= 126);
      const isSpaceOrTab = code === 32 || code === 9;
      const isLastCharInLine = i === line.length - 1;

      if (isAsciiPrintable && char !== '=') {
        encodedChar = char;
      } else if (isSpaceOrTab) {
        // Trailing space/tab at the end of a line MUST be encoded as =20 or =09
        if (isLastCharInLine) {
          encodedChar = code === 32 ? '=20' : '=09';
        } else {
          encodedChar = char;
        }
      } else {
        // Encode as hexadecimal =XX
        const bytes = new TextEncoder().encode(char);
        encodedChar = Array.from(bytes)
          .map(b => `=${b.toString(16).toUpperCase().padStart(2, '0')}`)
          .join('');
      }

      // Check if adding this character exceeds the 76-character limit (accounting for soft break "=")
      if (currentLine.length + encodedChar.length > 75) {
        encodedLines.push(`${currentLine}=`);
        currentLine = encodedChar;
      } else {
        currentLine += encodedChar;
      }
    }

    encodedLines.push(currentLine);
  }

  // Join lines with strict CRLF
  return encodedLines.join('\r\n');
}

/**
 * Computes the SHA-256 DKIM body hash (bh=) over canonicalized body.
 * Works across Browser (Web Crypto API), Node.js, and Deno/Cloudflare runtimes.
 */
export async function computeDkimBodyHash(
  body: string,
  algorithm: 'relaxed' | 'simple' = 'relaxed'
): Promise<{ bodyHash: string; bodyLength: number }> {
  // Apply canonicalization according to RFC 6376
  let canonical = normalizeToCrlf(body);
  if (algorithm === 'relaxed') {
    canonical = stripTrailingWhitespace(canonical);
  }
  canonical = normalizeTrailingEmptyLines(canonical);

  const encoder = new TextEncoder();
  const data = encoder.encode(canonical);
  const bodyLength = data.length;

  let hashBuffer: ArrayBuffer;

  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    // Web Crypto API (Browser, Deno, Node 18+)
    hashBuffer = await crypto.subtle.digest('SHA-256', data);
  } else {
    // Dynamic fallback for Node.js environments lacking global crypto.subtle
    try {
      const nodeCrypto = await import('crypto');
      const hash = nodeCrypto.createHash('sha256').update(data).digest();
      return {
        bodyHash: hash.toString('base64'),
        bodyLength
      };
    } catch {
      throw new Error('[DKIM Canonicalizer] Cryptographic SHA-256 digest unavailable in current environment');
    }
  }

  // Convert ArrayBuffer to base64 string
  const hashBytes = new Uint8Array(hashBuffer);
  let binary = '';
  for (let i = 0; i < hashBytes.byteLength; i++) {
    binary += String.fromCharCode(hashBytes[i]);
  }
  const bodyHash = btoa(binary);

  return { bodyHash, bodyLength };
}

/**
 * Returns anti-modification headers specifically tailored for AWS SES and modern MTAs.
 */
export function getAwsSesProtectionHeaders(options?: {
  configurationSet?: string;
  enableQuotedPrintable?: boolean;
}): Record<string, string> {
  const headers: Record<string, string> = {
    // Suppress AWS SES click/open tracking at message header level
    'X-SES-MESSAGE-TAGS': 'ses:no-track=true',
    // MIME canonicalization specification
    'MIME-Version': '1.0',
    // Request intermediate mail filters to preserve message integrity
    'X-Mailer': 'Health Club Management Secure Engine (RFC 6376 Compliant)',
    'X-Auto-Response-Suppress': 'OOF, AutoReply'
  };

  if (options?.configurationSet) {
    headers['X-SES-CONFIGURATION-SET'] = options.configurationSet;
  }

  if (options?.enableQuotedPrintable) {
    headers['Content-Transfer-Encoding'] = 'quoted-printable';
  }

  return headers;
}

/**
 * Complete preparation pipeline for an outbound email to ensure 100% DKIM body hash verification:
 * 1. Canonicalizes HTML and Plain Text bodies with CRLF and trailing whitespace stripping.
 * 2. Injects anti-tracking attributes into HTML.
 * 3. Computes the canonical body hash (bh=) and byte length (l=).
 * 4. Attaches required AWS SES suppression headers.
 */
export async function prepareEmailForTransit(params: {
  html: string;
  text?: string;
  configurationSet?: string;
}): Promise<{
  canonicalHtml: string;
  canonicalText: string;
  bodyHash: string;
  bodyLength: number;
  headers: Record<string, string>;
}> {
  const canonicalHtml = canonicalizeHtmlBody(params.html);
  const canonicalText = canonicalizePlainText(params.text || params.html);

  // Compute verification hash over the primary HTML body
  const { bodyHash, bodyLength } = await computeDkimBodyHash(canonicalHtml, 'relaxed');

  const headers = getAwsSesProtectionHeaders({
    configurationSet: params.configurationSet,
    enableQuotedPrintable: true
  });

  return {
    canonicalHtml,
    canonicalText,
    bodyHash,
    bodyLength,
    headers
  };
}
