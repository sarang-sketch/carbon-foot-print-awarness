/**
 * @fileoverview Test suite for security utilities.
 *
 * Tests HTML sanitization, URL encoding, CSV formula injection
 * prevention, JSON serialization safety, rate limiting, and
 * Content Security Policy header generation.
 *
 * @module tests/security.test
 * @license MIT
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeHtml,
  encodeUrlParam,
  isAllowedUrl,
  escapeCsvCell,
  buildSafeCsv,
  safeJsonStringify,
  generateCspHeader,
  getSecurityHeaders,
  createRateLimiter,
} from '../src/security.js';

// ─── HTML Sanitization ──────────────────────────────────────────────────────────

test('sanitizeHtml strips script tags', () => {
  assert.equal(sanitizeHtml('<script>alert("xss")</script>'), 'alert("xss")');
});

test('sanitizeHtml strips nested HTML tags', () => {
  assert.equal(sanitizeHtml('<div><b>Bold</b> <i>italic</i></div>'), 'Bold italic');
});

test('sanitizeHtml strips event handler attributes', () => {
  assert.equal(sanitizeHtml('<img src=x onerror=alert(1)>'), '');
});

test('sanitizeHtml preserves safe text and symbols', () => {
  assert.equal(sanitizeHtml('CO₂ emissions & energy'), 'CO₂ emissions & energy');
});

test('sanitizeHtml removes control characters', () => {
  assert.equal(sanitizeHtml('Hello\x00\x01\x1fWorld'), 'Hello World');
});

test('sanitizeHtml normalizes whitespace', () => {
  assert.equal(sanitizeHtml('  multiple   spaces  '), 'multiple spaces');
});

test('sanitizeHtml handles empty and undefined', () => {
  assert.equal(sanitizeHtml(''), '');
  assert.equal(sanitizeHtml(undefined), '');
  assert.equal(sanitizeHtml(null), 'null');
});

test('sanitizeHtml handles numeric input', () => {
  assert.equal(sanitizeHtml(42), '42');
  assert.equal(sanitizeHtml(3.14), '3.14');
});

// ─── URL Encoding ───────────────────────────────────────────────────────────────

test('encodeUrlParam encodes special characters', () => {
  const encoded = encodeUrlParam('Hello World & More');
  assert.match(encoded, /Hello%20World/);
  assert.match(encoded, /%26/);
});

test('encodeUrlParam sanitizes HTML before encoding', () => {
  const encoded = encodeUrlParam('<script>hack</script>');
  assert.equal(encoded.includes('<script>'), false);
});

test('encodeUrlParam handles empty input', () => {
  assert.equal(encodeUrlParam(''), '');
  assert.equal(encodeUrlParam(), '');
});

// ─── URL Validation ─────────────────────────────────────────────────────────────

test('isAllowedUrl accepts HTTPS URLs', () => {
  assert.equal(isAllowedUrl('https://google.com'), true);
  assert.equal(isAllowedUrl('https://maps.google.com/dir'), true);
});

test('isAllowedUrl rejects javascript: URLs', () => {
  assert.equal(isAllowedUrl('javascript:alert(1)'), false);
});

test('isAllowedUrl rejects data: URLs', () => {
  assert.equal(isAllowedUrl('data:text/html,<script>alert(1)</script>'), false);
});

test('isAllowedUrl rejects invalid URLs', () => {
  assert.equal(isAllowedUrl('not a url'), false);
  assert.equal(isAllowedUrl(''), false);
});

test('isAllowedUrl supports custom allowed schemes', () => {
  assert.equal(isAllowedUrl('http://example.com', ['http:', 'https:']), true);
  assert.equal(isAllowedUrl('ftp://example.com', ['ftp:']), true);
});

// ─── CSV Formula Injection ──────────────────────────────────────────────────────

test('escapeCsvCell prefixes formula triggers', () => {
  assert.match(escapeCsvCell('=SUM(A1:A10)'), /^"'=/);
  assert.match(escapeCsvCell('+cmd("hack")'), /^"'\+/);
  assert.match(escapeCsvCell('-negative'), /^"'-/);
  assert.match(escapeCsvCell('@IMPORTDATA("url")'), /^"'@/);
});

test('escapeCsvCell escapes double quotes', () => {
  assert.match(escapeCsvCell('has "quotes"'), /has ""/);
});

test('escapeCsvCell wraps values in double quotes', () => {
  const result = escapeCsvCell('simple text');
  assert.equal(result.startsWith('"'), true);
  assert.equal(result.endsWith('"'), true);
});

test('escapeCsvCell handles null and undefined', () => {
  assert.equal(escapeCsvCell(null), '""');
  assert.equal(escapeCsvCell(undefined), '""');
});

test('buildSafeCsv creates valid CSV with headers', () => {
  const csv = buildSafeCsv(['name', 'value'], [
    { name: 'test', value: 42 },
    { name: 'other', value: 10 },
  ]);
  const lines = csv.split('\n');
  assert.equal(lines.length, 3); // header + 2 rows
  assert.match(lines[0], /"name","value"/);
});

test('buildSafeCsv handles empty rows', () => {
  const csv = buildSafeCsv(['a', 'b'], []);
  assert.equal(csv.split('\n').length, 1); // Header only
});

test('buildSafeCsv prevents injection in all cells', () => {
  const csv = buildSafeCsv(['data'], [{ data: '=IMPORTXML("evil")' }]);
  assert.match(csv, /'=IMPORTXML/);
});

// ─── JSON Serialization ────────────────────────────────────────────────────────

test('safeJsonStringify serializes objects', () => {
  const json = safeJsonStringify({ key: 'value', num: 42 });
  const parsed = JSON.parse(json);
  assert.equal(parsed.key, 'value');
  assert.equal(parsed.num, 42);
});

test('safeJsonStringify handles null and primitives', () => {
  assert.equal(safeJsonStringify(null), 'null');
  assert.equal(safeJsonStringify(42), '42');
  assert.equal(safeJsonStringify('hello'), '"hello"');
});

test('safeJsonStringify handles circular references', () => {
  const obj = { a: 1 };
  obj.self = obj;
  const json = safeJsonStringify(obj);
  assert.ok(json.includes('[Circular]'));
});

// ─── Content Security Policy ────────────────────────────────────────────────────

test('generateCspHeader returns valid CSP string', () => {
  const csp = generateCspHeader();
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
});

test('getSecurityHeaders includes all required headers', () => {
  const headers = getSecurityHeaders();
  assert.ok(headers['Content-Security-Policy']);
  assert.ok(headers['X-Content-Type-Options']);
  assert.ok(headers['X-Frame-Options']);
  assert.ok(headers['X-XSS-Protection']);
  assert.ok(headers['Referrer-Policy']);
  assert.ok(headers['Permissions-Policy']);
});

test('getSecurityHeaders returns frozen object', () => {
  const headers = getSecurityHeaders();
  assert.ok(Object.isFrozen(headers));
});

// ─── Rate Limiter ───────────────────────────────────────────────────────────────

test('createRateLimiter allows initial requests', () => {
  const limiter = createRateLimiter(3, 100);
  assert.equal(limiter.tryConsume(), true);
  assert.equal(limiter.tryConsume(), true);
  assert.equal(limiter.tryConsume(), true);
});

test('createRateLimiter blocks when exhausted', () => {
  const limiter = createRateLimiter(2, 60000);
  limiter.tryConsume();
  limiter.tryConsume();
  assert.equal(limiter.tryConsume(), false);
});

test('createRateLimiter reports remaining tokens', () => {
  const limiter = createRateLimiter(5, 60000);
  assert.equal(limiter.remaining(), 5);
  limiter.tryConsume();
  assert.equal(limiter.remaining(), 4);
});
