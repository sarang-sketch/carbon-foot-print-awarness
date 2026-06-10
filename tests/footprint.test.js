/**
 * @fileoverview Carbon Compass — Comprehensive Test Suite
 *
 * Tests cover: calculations, scoring, ranking, action plans,
 * Google URL generation, CSV export, Gemini prompts, input
 * sanitization, comparison metrics, pledge system, and edge cases.
 *
 * Run with: node --test
 *
 * @module tests/footprint.test
 * @license MIT
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateFootprint,
  classifyScore,
  buildActionPlan,
  buildGoogleMapsTransitUrl,
  buildGoogleCalendarUrl,
  buildGoogleSheetCsv,
  buildGeminiPrompt,
  buildGoogleSearchUrl,
  buildComparisons,
  rankCategories,
  sanitizeText,
  getGoogleToolForCategory,
  CATEGORY_COLORS,
} from '../src/footprint.js';

// ─── Calculation Tests ──────────────────────────────────────────────────────────

test('calculateFootprint produces correct monthly kg CO₂e with known inputs', () => {
  const result = calculateFootprint({
    electricityKwh: 120,
    gasTherms: 10,
    carKm: 300,
    transitKm: 80,
    flightsShort: 1,
    flightsLong: 0,
    meatMeals: 10,
    dairyMeals: 12,
    shoppingSpend: 150,
  });

  assert.equal(result.totalKg, 578.8);
  assert.deepEqual(Object.keys(result.breakdown), ['home', 'transport', 'food', 'consumption']);
  assert.equal(result.breakdown.transport, 226.6);
  assert.equal(result.breakdown.home, 103.4);
  assert.equal(result.breakdown.food, 89);
  assert.equal(result.breakdown.consumption, 159.8);
  assert.equal(result.unit, 'kg CO2e/month');
});

test('calculateFootprint returns zero for empty input', () => {
  const result = calculateFootprint({});
  assert.equal(result.totalKg, 0);
  assert.deepEqual(result.breakdown, { home: 0, transport: 0, food: 0, consumption: 0 });
});

test('calculateFootprint handles negative and invalid input safely', () => {
  const result = calculateFootprint({
    electricityKwh: -100,
    gasTherms: 'not a number',
    carKm: NaN,
    transitKm: Infinity,
    flightsShort: null,
    flightsLong: undefined,
    meatMeals: '',
    dairyMeals: 0,
    shoppingSpend: false,
  });

  assert.equal(result.totalKg, 0);
  Object.values(result.breakdown).forEach((v) => {
    assert.ok(v >= 0, `Expected non-negative value, got ${v}`);
  });
});

test('calculateFootprint computes per-capita footprint', () => {
  const result = calculateFootprint({
    electricityKwh: 200,
    gasTherms: 20,
    household: 4,
  });

  assert.ok(result.perCapita > 0);
  assert.ok(result.perCapita < result.totalKg);
  assert.equal(result.perCapita, Math.round((result.totalKg / 4) * 10) / 10);
});

test('calculateFootprint per-capita defaults to total when household is 1', () => {
  const result = calculateFootprint({ electricityKwh: 100, household: 1 });
  assert.equal(result.perCapita, result.totalKg);
});

// ─── Scoring Tests ──────────────────────────────────────────────────────────────

test('classifyScore gives correct bands for all tiers', () => {
  // Planet Protector
  assert.equal(classifyScore(0).rank, 'Planet Protector');
  assert.equal(classifyScore(100).rank, 'Planet Protector');
  assert.equal(classifyScore(350).rank, 'Planet Protector');
  assert.equal(classifyScore(350).color, 'green');

  // Carbon Climber
  assert.equal(classifyScore(351).rank, 'Carbon Climber');
  assert.equal(classifyScore(500).rank, 'Carbon Climber');
  assert.equal(classifyScore(800).rank, 'Carbon Climber');
  assert.equal(classifyScore(650).color, 'amber');

  // High Impact
  assert.equal(classifyScore(801).rank, 'High Impact');
  assert.equal(classifyScore(1200).rank, 'High Impact');
  assert.equal(classifyScore(5000).rank, 'High Impact');
  assert.equal(classifyScore(1200).color, 'red');
});

test('classifyScore includes emoji field', () => {
  assert.ok(classifyScore(100).emoji);
  assert.ok(classifyScore(500).emoji);
  assert.ok(classifyScore(1000).emoji);
});

test('classifyScore has meaningful messages', () => {
  const green = classifyScore(200);
  const amber = classifyScore(600);
  const red = classifyScore(1000);

  assert.ok(green.message.length > 20);
  assert.ok(amber.message.length > 20);
  assert.ok(red.message.length > 20);
});

// ─── Category Ranking Tests ─────────────────────────────────────────────────────

test('rankCategories sorts categories by kg descending', () => {
  const ranked = rankCategories({ home: 120, transport: 500, food: 180, consumption: 100 });
  assert.equal(ranked[0].category, 'transport');
  assert.equal(ranked[1].category, 'food');
  assert.equal(ranked[2].category, 'home');
  assert.equal(ranked[3].category, 'consumption');
});

test('rankCategories calculates correct percentages', () => {
  const ranked = rankCategories({ home: 50, transport: 50 });
  assert.equal(ranked[0].percentage, 50);
  assert.equal(ranked[1].percentage, 50);
});

test('rankCategories handles empty breakdown', () => {
  const ranked = rankCategories({});
  assert.equal(ranked.length, 0);
});

// ─── Action Plan Tests ──────────────────────────────────────────────────────────

test('buildActionPlan adapts to largest category', () => {
  const plan = buildActionPlan({
    profile: { commuteMode: 'car', household: 4, goal: 'save money' },
    footprint: {
      totalKg: 900,
      breakdown: { home: 120, transport: 500, food: 180, consumption: 100 },
    },
  });

  assert.equal(plan[0].category, 'transport');
  assert.match(plan[0].title, /transit|carpool|bike/i);
  assert.ok(plan.some((item) => item.googleTool === 'Google Maps'));
});

test('buildActionPlan prioritizes home category when home is largest', () => {
  const plan = buildActionPlan({
    profile: { commuteMode: 'bus', goal: 'reduce emissions' },
    footprint: {
      totalKg: 600,
      breakdown: { home: 400, transport: 50, food: 100, consumption: 50 },
    },
  });

  assert.equal(plan[0].category, 'home');
  assert.ok(plan.some((item) => item.googleTool.includes('Calendar') || item.googleTool.includes('Home')));
});

test('buildActionPlan adapts whyNow for health goal', () => {
  const plan = buildActionPlan({
    profile: { commuteMode: 'car', goal: 'health' },
    footprint: {
      totalKg: 500,
      breakdown: { home: 100, transport: 200, food: 150, consumption: 50 },
    },
  });

  assert.ok(plan[0].whyNow.includes('health'));
});

test('buildActionPlan always includes a tracking step', () => {
  const plan = buildActionPlan({
    profile: {},
    footprint: { totalKg: 100, breakdown: { home: 25, transport: 25, food: 25, consumption: 25 } },
  });

  const trackingStep = plan.find((item) => item.category === 'tracking');
  assert.ok(trackingStep, 'Plan must include a tracking step');
  assert.ok(trackingStep.googleTool.includes('Calendar'));
});

test('buildActionPlan works with empty input', () => {
  const plan = buildActionPlan({});
  assert.ok(Array.isArray(plan));
  assert.ok(plan.length >= 2);
});

// ─── Google URL Tests ───────────────────────────────────────────────────────────

test('Google Maps URL is properly encoded and prevents injection', () => {
  const maps = buildGoogleMapsTransitUrl('Home <script>', 'Office & Gym');
  assert.equal(maps.includes('<script>'), false);
  assert.match(maps, /^https:\/\/www\.google\.com\/maps\/dir\//);
  assert.match(maps, /travelmode=transit/);
});

test('Google Maps URL handles empty inputs', () => {
  const maps = buildGoogleMapsTransitUrl('', '');
  assert.match(maps, /^https:\/\/www\.google\.com\/maps\/dir\//);
});

test('Google Calendar URL is properly formatted', () => {
  const calendar = buildGoogleCalendarUrl({
    title: 'Carbon review',
    details: 'Check progress <img src=x onerror=alert(1)>',
    start: '2026-06-15T09:00:00Z',
    end: '2026-06-15T09:30:00Z',
  });
  assert.equal(calendar.includes('<img'), false);
  assert.match(calendar, /calendar\.google\.com/);
  assert.match(calendar, /action=TEMPLATE/);
});

test('Google Calendar URL works with defaults', () => {
  const calendar = buildGoogleCalendarUrl({});
  assert.match(calendar, /calendar\.google\.com/);
  assert.match(calendar, /Carbon\+footprint\+review/);
});

test('Google Search URL generates category-specific queries', () => {
  const homeUrl = buildGoogleSearchUrl('home');
  const transportUrl = buildGoogleSearchUrl('transport');
  const foodUrl = buildGoogleSearchUrl('food');
  const consumptionUrl = buildGoogleSearchUrl('consumption');

  assert.match(homeUrl, /google\.com\/search/);
  assert.match(homeUrl, /energy/i);
  assert.match(transportUrl, /carbon|transit/i);
  assert.match(foodUrl, /plant|recipe/i);
  assert.match(consumptionUrl, /eco|sustainable/i);
});

test('Google Search URL defaults to transport for unknown category', () => {
  const url = buildGoogleSearchUrl('unknown');
  assert.match(url, /google\.com\/search/);
});

// ─── CSV Export Tests ───────────────────────────────────────────────────────────

test('Google Sheets CSV export escapes spreadsheet formula injection', () => {
  const csv = buildGoogleSheetCsv([
    { category: 'home', kg: 10, note: '=IMPORTXML("bad")' },
    { category: 'food', kg: 20, note: '+malicious' },
    { category: 'transport', kg: 30, note: '-cmd("hack")' },
    { category: 'consumption', kg: 40, note: '@IMPORTDATA("url")' },
  ]);

  assert.match(csv, /"'=IMPORTXML\(""bad""\)"/);
  assert.match(csv, /"'\+malicious"/);
  assert.match(csv, /"'-cmd\(""hack""\)"/);
  assert.match(csv, /"'@IMPORTDATA\(""url""\)"/);
});

test('CSV includes header row', () => {
  const csv = buildGoogleSheetCsv([]);
  assert.match(csv, /"category","kg","note"/);
});

test('CSV handles empty rows array', () => {
  const csv = buildGoogleSheetCsv([]);
  const lines = csv.split('\n');
  assert.equal(lines.length, 1); // Header only
});

test('CSV handles special characters in values', () => {
  const csv = buildGoogleSheetCsv([
    { category: 'home & garden', kg: 10, note: 'has "quotes" inside' },
  ]);
  assert.ok(csv.includes('home'));
  assert.ok(csv.includes('""quotes""'));
});

// ─── Gemini Prompt Tests ────────────────────────────────────────────────────────

test('Gemini prompt is concise, sanitized, and contextual', () => {
  const prompt = buildGeminiPrompt({ totalKg: 700, topCategory: 'transport<script>' });
  assert.equal(prompt.includes('<script>'), false);
  assert.ok(prompt.length < 700);
  assert.match(prompt, /carbon coach/i);
  assert.match(prompt, /700/);
  assert.match(prompt, /transport/);
  assert.match(prompt, /7 days/);
  assert.match(prompt, /practical/i);
});

test('Gemini prompt works with zero footprint', () => {
  const prompt = buildGeminiPrompt({ totalKg: 0 });
  assert.match(prompt, /0/);
  assert.ok(prompt.length > 50);
});

test('Gemini prompt works with default values', () => {
  const prompt = buildGeminiPrompt();
  assert.ok(prompt.length > 50);
  assert.match(prompt, /carbon coach/i);
});

// ─── Sanitization Tests ────────────────────────────────────────────────────────

test('sanitizeText removes HTML tags while keeping readable text', () => {
  assert.equal(sanitizeText('Bike <b>more</b> & save'), 'Bike more & save');
});

test('sanitizeText removes script tags', () => {
  assert.equal(sanitizeText('<script>alert("xss")</script>Hello'), 'alert("xss")Hello');
});

test('sanitizeText strips control characters', () => {
  assert.equal(sanitizeText('Hello\x00\x01\x1fWorld'), 'Hello World');
});

test('sanitizeText trims and normalizes whitespace', () => {
  assert.equal(sanitizeText('  hello    world  '), 'hello world');
});

test('sanitizeText handles empty and undefined values', () => {
  assert.equal(sanitizeText(''), '');
  assert.equal(sanitizeText(undefined), '');
  // String(null) === 'null' — this is correct JS coercion behavior
  assert.equal(sanitizeText(null), 'null');
});

test('sanitizeText handles numbers', () => {
  assert.equal(sanitizeText(42), '42');
});

// ─── Comparison Metrics Tests ───────────────────────────────────────────────────

test('buildComparisons generates all metric fields', () => {
  const comp = buildComparisons(500);
  assert.ok('treesNeeded' in comp);
  assert.ok('equivalentCarKm' in comp);
  assert.ok('equivalentFlights' in comp);
  assert.ok('vsGlobalAverage' in comp);
  assert.ok('lightbulbHours' in comp);
  assert.ok('beefBurgers' in comp);
});

test('buildComparisons calculates trees correctly', () => {
  const comp = buildComparisons(100);
  // 100 kg/month * 12 = 1200 kg/year, / 22 kg per tree ≈ 55 trees
  assert.equal(comp.treesNeeded, Math.ceil(1200 / 22));
});

test('buildComparisons handles zero emissions', () => {
  const comp = buildComparisons(0);
  assert.equal(comp.treesNeeded, 0);
  assert.equal(comp.equivalentCarKm, 0);
  assert.equal(comp.equivalentFlights, 0);
  assert.equal(comp.vsGlobalAverage, '0%');
});

test('buildComparisons global average percentage makes sense', () => {
  const comp = buildComparisons(333); // Global average
  assert.equal(comp.vsGlobalAverage, '100%');
});

// ─── Google Tool Mapping Tests ──────────────────────────────────────────────────

test('getGoogleToolForCategory maps known categories', () => {
  assert.equal(getGoogleToolForCategory('home'), 'Google Home / Nest Renew');
  assert.equal(getGoogleToolForCategory('transport'), 'Google Maps');
  assert.equal(getGoogleToolForCategory('food'), 'Google Search');
  assert.equal(getGoogleToolForCategory('consumption'), 'Google Shopping');
});

test('getGoogleToolForCategory falls back to Google Search', () => {
  assert.equal(getGoogleToolForCategory('unknown'), 'Google Search');
  assert.equal(getGoogleToolForCategory(''), 'Google Search');
});

// ─── Category Colors Tests ──────────────────────────────────────────────────────

test('CATEGORY_COLORS has entries for all categories', () => {
  assert.ok(CATEGORY_COLORS.home);
  assert.ok(CATEGORY_COLORS.transport);
  assert.ok(CATEGORY_COLORS.food);
  assert.ok(CATEGORY_COLORS.consumption);
});

test('CATEGORY_COLORS values are valid hex colors', () => {
  Object.values(CATEGORY_COLORS).forEach((color) => {
    assert.match(color, /^#[0-9a-fA-F]{6}$/);
  });
});

// ─── Integration Tests ──────────────────────────────────────────────────────────

test('Full pipeline: input → calculate → classify → plan → export', () => {
  // Step 1: Calculate
  const footprint = calculateFootprint({
    electricityKwh: 150,
    gasTherms: 15,
    carKm: 400,
    transitKm: 50,
    flightsShort: 2,
    flightsLong: 0,
    meatMeals: 15,
    dairyMeals: 10,
    shoppingSpend: 200,
  });

  // Step 2: Classify
  const score = classifyScore(footprint.totalKg);

  // Step 3: Build plan
  const plan = buildActionPlan({
    profile: { commuteMode: 'car', goal: 'save money' },
    footprint,
  });

  // Step 4: Build URLs
  const mapsUrl = buildGoogleMapsTransitUrl('Home', 'Work');
  const calendarUrl = buildGoogleCalendarUrl({
    title: 'Review',
    details: `Footprint: ${footprint.totalKg} kg`,
    start: '2026-07-01T09:00:00Z',
    end: '2026-07-01T09:30:00Z',
  });

  // Step 5: Export
  const csv = buildGoogleSheetCsv(
    Object.entries(footprint.breakdown).map(([cat, kg]) => ({
      category: cat, kg, note: `${cat} emissions`,
    })),
  );

  // Step 6: Comparisons
  const comparisons = buildComparisons(footprint.totalKg);

  // Verify all outputs
  assert.ok(footprint.totalKg > 0, 'Footprint should be positive');
  assert.ok(score.rank, 'Score should have rank');
  assert.ok(plan.length >= 2, 'Plan should have actions');
  assert.match(mapsUrl, /google\.com\/maps/);
  assert.match(calendarUrl, /calendar\.google\.com/);
  assert.ok(csv.includes('category'), 'CSV should have headers');
  assert.ok(comparisons.treesNeeded > 0, 'Should need trees to offset');
});

test('Footprint calculation is deterministic', () => {
  const input = {
    electricityKwh: 100,
    gasTherms: 8,
    carKm: 200,
    transitKm: 40,
    flightsShort: 0,
    flightsLong: 1,
    meatMeals: 8,
    dairyMeals: 10,
    shoppingSpend: 100,
  };

  const result1 = calculateFootprint(input);
  const result2 = calculateFootprint(input);

  assert.deepEqual(result1, result2, 'Same input must produce identical output');
});
