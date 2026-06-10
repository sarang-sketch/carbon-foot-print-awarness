/**
 * @fileoverview Test suite for analytics and reporting module.
 *
 * Tests statistical functions, trend analysis, category analysis,
 * comparison equivalents, and report generation.
 *
 * @module tests/analytics.test
 * @license MIT
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  average,
  median,
  minMax,
  standardDeviation,
  analyzeTrend,
  percentageChange,
  analyzeCategories,
  buildEquivalents,
  generateReport,
  generateSummary,
} from '../src/analytics.js';

// ─── Statistical Functions ──────────────────────────────────────────────────────

test('average calculates correct mean', () => {
  assert.equal(average([10, 20, 30]), 20);
  assert.equal(average([100]), 100);
});

test('average returns 0 for empty arrays', () => {
  assert.equal(average([]), 0);
  assert.equal(average(null), 0);
  assert.equal(average(undefined), 0);
});

test('average handles non-numeric values gracefully', () => {
  assert.equal(average([10, 'invalid', 30]), 13.3);
});

test('median calculates correct middle value', () => {
  assert.equal(median([1, 3, 5]), 3);
  assert.equal(median([1, 2, 3, 4]), 2.5);
});

test('median returns 0 for empty arrays', () => {
  assert.equal(median([]), 0);
});

test('minMax finds correct extremes', () => {
  const result = minMax([5, 2, 8, 1, 9]);
  assert.equal(result.min, 1);
  assert.equal(result.max, 9);
});

test('minMax returns zeros for empty arrays', () => {
  const result = minMax([]);
  assert.equal(result.min, 0);
  assert.equal(result.max, 0);
});

test('standardDeviation calculates spread', () => {
  const sd = standardDeviation([10, 10, 10]);
  assert.equal(sd, 0);
});

test('standardDeviation returns 0 for single values', () => {
  assert.equal(standardDeviation([5]), 0);
  assert.equal(standardDeviation([]), 0);
});

// ─── Trend Analysis ─────────────────────────────────────────────────────────────

test('analyzeTrend detects improving trend', () => {
  const result = analyzeTrend([500, 450, 400, 350, 300]);
  assert.equal(result.direction, 'improving');
  assert.ok(result.slope < 0);
});

test('analyzeTrend detects increasing trend', () => {
  const result = analyzeTrend([200, 250, 300, 350, 400]);
  assert.equal(result.direction, 'increasing');
  assert.ok(result.slope > 0);
});

test('analyzeTrend detects stable trend', () => {
  const result = analyzeTrend([300, 301, 299, 300, 301]);
  assert.equal(result.direction, 'stable');
});

test('analyzeTrend handles insufficient data', () => {
  assert.equal(analyzeTrend([]).direction, 'stable');
  assert.equal(analyzeTrend([100]).direction, 'stable');
  assert.equal(analyzeTrend([100]).confidence, 'low');
});

test('analyzeTrend reports confidence levels', () => {
  const low = analyzeTrend([1, 2, 3]);
  assert.equal(low.confidence, 'low');

  const medium = analyzeTrend([1, 2, 3, 4, 5, 6, 7]);
  assert.equal(medium.confidence, 'medium');
});

test('percentageChange calculates correct changes', () => {
  assert.equal(percentageChange(100, 150), 50);
  assert.equal(percentageChange(100, 50), -50);
  assert.equal(percentageChange(100, 100), 0);
});

test('percentageChange handles zero base', () => {
  assert.equal(percentageChange(0, 0), 0);
  assert.equal(percentageChange(0, 50), 100);
});

// ─── Category Analysis ──────────────────────────────────────────────────────────

test('analyzeCategories processes multiple breakdowns', () => {
  const result = analyzeCategories([
    { home: 100, transport: 200, food: 80, consumption: 120 },
    { home: 90, transport: 190, food: 75, consumption: 110 },
  ]);

  assert.ok(result.home);
  assert.ok(result.transport);
  assert.ok(result.food);
  assert.ok(result.consumption);
  assert.ok(result.home.average > 0);
  assert.ok(result.home.label);
});

test('analyzeCategories handles empty input', () => {
  const result = analyzeCategories([]);
  assert.deepEqual(result, {});
});

// ─── Comparison Equivalents ─────────────────────────────────────────────────────

test('buildEquivalents generates all metrics', () => {
  const eq = buildEquivalents(500);
  assert.ok(eq.trees);
  assert.ok(eq.carKm);
  assert.ok(eq.flights);
  assert.ok(eq.globalAverage);
  assert.ok(eq.lightbulbHours);
  assert.ok(eq.burgers);
  assert.ok(eq.smartphones);
  assert.ok(eq.showers);
});

test('buildEquivalents has correct structure', () => {
  const eq = buildEquivalents(100);
  Object.values(eq).forEach((metric) => {
    assert.ok('value' in metric, 'Metric must have value');
    assert.ok('label' in metric, 'Metric must have label');
    assert.ok('icon' in metric, 'Metric must have icon');
  });
});

test('buildEquivalents trees calculation is correct', () => {
  const eq = buildEquivalents(100);
  // 100 kg/month * 12 = 1200 kg/year / 22 kg per tree
  assert.equal(eq.trees.value, Math.ceil(1200 / 22));
});

test('buildEquivalents handles zero', () => {
  const eq = buildEquivalents(0);
  assert.equal(eq.trees.value, 0);
  assert.equal(eq.carKm.value, 0);
  assert.equal(eq.globalAverage.value, '0%');
});

// ─── Report Generation ──────────────────────────────────────────────────────────

test('generateReport produces formatted text', () => {
  const report = generateReport({
    footprint: {
      totalKg: 500,
      perCapita: 167,
      breakdown: { home: 100, transport: 200, food: 100, consumption: 100 },
    },
    score: { rank: 'Carbon Climber', color: 'amber' },
    profile: { household: 3, commuteMode: 'car', goal: 'save money' },
  });

  assert.match(report, /500/);
  assert.match(report, /Carbon Climber/);
  assert.match(report, /CARBON COMPASS/);
  assert.match(report, /Breakdown/);
  assert.match(report, /Equivalents/);
});

test('generateReport handles empty assessment', () => {
  const report = generateReport({});
  assert.ok(report.length > 0);
  assert.match(report, /CARBON COMPASS/);
});

test('generateReport includes trend when history provided', () => {
  const history = [
    { footprint: { totalKg: 500 } },
    { footprint: { totalKg: 450 } },
    { footprint: { totalKg: 400 } },
  ];
  const report = generateReport({ footprint: { totalKg: 400, breakdown: {} }, score: {}, profile: {} }, history);
  assert.match(report, /Trend/i);
});

// ─── Summary Generation ─────────────────────────────────────────────────────────

test('generateSummary returns structured result', () => {
  const result = generateSummary({
    footprint: {
      totalKg: 300,
      breakdown: { home: 100, transport: 50, food: 80, consumption: 70 },
    },
    score: { rank: 'Planet Protector' },
    plan: [{ title: 'Reduce energy use' }],
  });

  assert.ok(result.summary);
  assert.ok(Array.isArray(result.highlights));
  assert.ok(result.topAction);
  assert.match(result.summary, /300/);
});

test('generateSummary handles low footprint', () => {
  const result = generateSummary({
    footprint: { totalKg: 200, breakdown: { home: 50, transport: 50, food: 50, consumption: 50 } },
    score: { rank: 'Planet Protector' },
    plan: [],
  });

  assert.ok(result.highlights.some((h) => h.includes('below')));
});
