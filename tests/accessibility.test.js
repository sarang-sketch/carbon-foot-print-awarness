/**
 * @fileoverview Test suite for accessibility utilities.
 *
 * Tests color contrast calculation, screen reader text generation,
 * and reduced motion detection. DOM-dependent tests are skipped
 * in Node.js environment.
 *
 * @module tests/accessibility.test
 * @license MIT
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hexToRgb,
  relativeLuminance,
  contrastRatio,
  meetsContrastRequirement,
  generateFootprintDescription,
  generateChartDescription,
} from '../src/accessibility.js';

// ─── hexToRgb Tests ─────────────────────────────────────────────────────────────

test('hexToRgb converts standard hex colors', () => {
  const result = hexToRgb('#ff0000');
  assert.deepEqual(result, { r: 255, g: 0, b: 0 });
});

test('hexToRgb handles colors without hash', () => {
  const result = hexToRgb('00ff00');
  assert.deepEqual(result, { r: 0, g: 255, b: 0 });
});

test('hexToRgb converts our accent green', () => {
  const result = hexToRgb('#34d399');
  assert.equal(result.r, 52);
  assert.equal(result.g, 211);
  assert.equal(result.b, 153);
});

test('hexToRgb returns null for invalid hex', () => {
  assert.equal(hexToRgb('not-hex'), null);
  assert.equal(hexToRgb('#fff'), null); // 3-digit not supported
  assert.equal(hexToRgb(''), null);
});

// ─── Relative Luminance Tests ───────────────────────────────────────────────────

test('relativeLuminance of white is 1', () => {
  const lum = relativeLuminance('#ffffff');
  assert.ok(Math.abs(lum - 1) < 0.01);
});

test('relativeLuminance of black is 0', () => {
  const lum = relativeLuminance('#000000');
  assert.equal(lum, 0);
});

test('relativeLuminance of mid-gray is ~0.2', () => {
  const lum = relativeLuminance('#808080');
  assert.ok(lum > 0.1 && lum < 0.3);
});

// ─── Contrast Ratio Tests ───────────────────────────────────────────────────────

test('contrastRatio of black on white is 21:1', () => {
  const ratio = contrastRatio('#000000', '#ffffff');
  assert.ok(Math.abs(ratio - 21) < 0.1);
});

test('contrastRatio of same colors is 1:1', () => {
  const ratio = contrastRatio('#333333', '#333333');
  assert.ok(Math.abs(ratio - 1) < 0.01);
});

test('contrastRatio is symmetric', () => {
  const ratio1 = contrastRatio('#34d399', '#0a0e1a');
  const ratio2 = contrastRatio('#0a0e1a', '#34d399');
  assert.ok(Math.abs(ratio1 - ratio2) < 0.01);
});

// ─── WCAG Compliance Tests ──────────────────────────────────────────────────────

test('meetsContrastRequirement passes for high contrast', () => {
  const result = meetsContrastRequirement('#ffffff', '#000000');
  assert.equal(result.passes, true);
  assert.ok(result.ratio >= 4.5);
  assert.equal(result.required, 4.5);
});

test('meetsContrastRequirement fails for low contrast', () => {
  const result = meetsContrastRequirement('#777777', '#888888');
  assert.equal(result.passes, false);
});

test('meetsContrastRequirement uses 3:1 for large text', () => {
  const result = meetsContrastRequirement('#ffffff', '#000000', 'large');
  assert.equal(result.required, 3);
});

test('Our accent green on dark bg meets WCAG AA', () => {
  const result = meetsContrastRequirement('#34d399', '#0a0e1a');
  assert.equal(result.passes, true, `Contrast ratio ${result.ratio} should pass AA (4.5:1)`);
});

test('Our text colors meet WCAG AA on dark bg', () => {
  // Primary text
  const primary = meetsContrastRequirement('#f9fafb', '#0a0e1a');
  assert.equal(primary.passes, true, `Primary text ratio ${primary.ratio} should pass`);

  // Secondary text
  const secondary = meetsContrastRequirement('#9ca3af', '#0a0e1a');
  assert.equal(secondary.passes, true, `Secondary text ratio ${secondary.ratio} should pass`);
});

// ─── Screen Reader Text Tests ───────────────────────────────────────────────────

test('generateFootprintDescription creates readable text', () => {
  const desc = generateFootprintDescription(500, 'Carbon Climber', 'transport');
  assert.match(desc, /500/);
  assert.match(desc, /Carbon Climber/);
  assert.match(desc, /transport/);
  assert.match(desc, /kilograms/);
});

test('generateChartDescription lists all categories', () => {
  const desc = generateChartDescription({
    home: 100,
    transport: 200,
    food: 80,
    consumption: 120,
  });
  assert.match(desc, /home/);
  assert.match(desc, /transport/);
  assert.match(desc, /food/);
  assert.match(desc, /consumption/);
  assert.match(desc, /kilograms/);
});

test('generateChartDescription sorts by kg descending', () => {
  const desc = generateChartDescription({ a: 10, b: 50, c: 30 });
  const bIndex = desc.indexOf('b:');
  const cIndex = desc.indexOf('c:');
  const aIndex = desc.indexOf('a:');
  assert.ok(bIndex < cIndex, 'b (50) should appear before c (30)');
  assert.ok(cIndex < aIndex, 'c (30) should appear before a (10)');
});
