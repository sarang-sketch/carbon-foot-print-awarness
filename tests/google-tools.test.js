/**
 * @fileoverview Test suite for Google Tools integration module.
 *
 * Tests all Google service URL builders for correctness,
 * security (injection prevention), and edge case handling.
 *
 * @module tests/google-tools.test
 * @license MIT
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMapsUrl,
  buildMapsComparisonUrls,
  buildCalendarUrl,
  buildMonthlyReviewUrl,
  buildGmailUrl,
  buildShareActionPlanUrl,
  buildSearchUrl,
  buildContextualSearchUrl,
  buildShoppingUrl,
  buildEarthUrl,
  buildTrendsUrl,
  buildScholarUrl,
  buildYouTubeUrl,
  buildDocsUrl,
  buildFormsUrl,
  buildKeepUrl,
  buildGeminiPrompt,
  buildDetailedGeminiPrompt,
  getToolForCategory,
  getAllToolIntegrations,
} from '../src/google-tools.js';

// ─── Google Maps Tests ──────────────────────────────────────────────────────────

test('buildMapsUrl generates valid transit URL', () => {
  const url = buildMapsUrl('Home', 'Office');
  assert.match(url, /^https:\/\/www\.google\.com\/maps\/dir\//);
  assert.match(url, /travelmode=transit/);
  assert.match(url, /origin=Home/);
  assert.match(url, /destination=Office/);
});

test('buildMapsUrl sanitizes HTML injection in origin', () => {
  const url = buildMapsUrl('<script>alert(1)</script>', 'Work');
  assert.equal(url.includes('<script>'), false);
  assert.equal(url.includes('</script>'), false);
});

test('buildMapsUrl accepts valid travel modes', () => {
  assert.match(buildMapsUrl('A', 'B', 'bicycling'), /travelmode=bicycling/);
  assert.match(buildMapsUrl('A', 'B', 'walking'), /travelmode=walking/);
  assert.match(buildMapsUrl('A', 'B', 'driving'), /travelmode=driving/);
});

test('buildMapsUrl defaults to transit for invalid modes', () => {
  assert.match(buildMapsUrl('A', 'B', 'jetpack'), /travelmode=transit/);
  assert.match(buildMapsUrl('A', 'B', ''), /travelmode=transit/);
});

test('buildMapsComparisonUrls returns all four modes', () => {
  const urls = buildMapsComparisonUrls('Home', 'Work');
  assert.equal(urls.length, 4);
  assert.ok(urls.some((u) => u.mode === 'transit'));
  assert.ok(urls.some((u) => u.mode === 'bicycling'));
  assert.ok(urls.some((u) => u.mode === 'walking'));
  assert.ok(urls.some((u) => u.mode === 'driving'));
  urls.forEach((u) => assert.match(u.url, /^https:\/\//));
});

// ─── Google Calendar Tests ──────────────────────────────────────────────────────

test('buildCalendarUrl generates valid event URL', () => {
  const url = buildCalendarUrl({
    title: 'Carbon Review',
    details: 'Check footprint',
    start: '2026-07-01T09:00:00Z',
    end: '2026-07-01T09:30:00Z',
  });
  assert.match(url, /calendar\.google\.com/);
  assert.match(url, /action=TEMPLATE/);
  assert.match(url, /Carbon\+Review/);
});

test('buildCalendarUrl sanitizes XSS in details', () => {
  const url = buildCalendarUrl({
    details: '<img src=x onerror=alert(1)>',
  });
  assert.equal(url.includes('<img'), false);
  assert.equal(url.includes('onerror'), false);
});

test('buildCalendarUrl works with defaults', () => {
  const url = buildCalendarUrl();
  assert.match(url, /calendar\.google\.com/);
  assert.match(url, /Carbon\+footprint\+review/);
});

test('buildMonthlyReviewUrl includes footprint data', () => {
  const url = buildMonthlyReviewUrl(500, 'transport');
  assert.match(url, /calendar\.google\.com/);
  assert.match(url, /500/);
});

// ─── Gmail Tests ────────────────────────────────────────────────────────────────

test('buildGmailUrl generates compose URL', () => {
  const url = buildGmailUrl({ subject: 'Test', body: 'Hello' });
  assert.match(url, /mail\.google\.com/);
  assert.match(url, /view=cm/);
});

test('buildShareActionPlanUrl includes footprint data', () => {
  const url = buildShareActionPlanUrl({
    totalKg: 450,
    rank: 'Carbon Climber',
    topCategory: 'transport',
    topAction: 'Use transit',
  });
  assert.match(url, /mail\.google\.com/);
  assert.match(url, /450/);
});

// ─── Google Search Tests ────────────────────────────────────────────────────────

test('buildSearchUrl generates category-specific queries', () => {
  assert.match(buildSearchUrl('home'), /energy/i);
  assert.match(buildSearchUrl('transport'), /transit|carbon/i);
  assert.match(buildSearchUrl('food'), /plant|recipe/i);
  assert.match(buildSearchUrl('consumption'), /eco|sustainable/i);
});

test('buildSearchUrl defaults gracefully for unknown category', () => {
  const url = buildSearchUrl('unknown');
  assert.match(url, /google\.com\/search/);
});

test('buildContextualSearchUrl appends user goal', () => {
  const url = buildContextualSearchUrl('home', 'save money');
  assert.match(url, /google\.com\/search/);
  assert.match(url, /save%20money/);
});

// ─── Google Shopping Tests ──────────────────────────────────────────────────────

test('buildShoppingUrl generates valid URL', () => {
  const url = buildShoppingUrl();
  assert.match(url, /google\.com\/shopping/);
  assert.match(url, /eco/i);
});

test('buildShoppingUrl accepts custom queries', () => {
  const url = buildShoppingUrl('reusable water bottles');
  assert.match(url, /reusable/i);
});

// ─── Google Earth Tests ─────────────────────────────────────────────────────────

test('buildEarthUrl returns valid URL', () => {
  const url = buildEarthUrl();
  assert.match(url, /earth\.google\.com/);
});

// ─── Google Trends Tests ────────────────────────────────────────────────────────

test('buildTrendsUrl generates comparison URL', () => {
  const url = buildTrendsUrl();
  assert.match(url, /trends\.google\.com/);
  assert.match(url, /carbon/i);
});

test('buildTrendsUrl accepts custom terms', () => {
  const url = buildTrendsUrl(['solar panels', 'wind energy']);
  assert.match(url, /solar/i);
  assert.match(url, /wind/i);
});

// ─── Google Scholar Tests ───────────────────────────────────────────────────────

test('buildScholarUrl generates research URL', () => {
  const url = buildScholarUrl();
  assert.match(url, /scholar\.google\.com/);
  assert.match(url, /carbon/i);
});

// ─── YouTube Tests ──────────────────────────────────────────────────────────────

test('buildYouTubeUrl generates search URL', () => {
  const url = buildYouTubeUrl();
  assert.match(url, /youtube\.com/);
});

// ─── Google Docs / Forms / Keep Tests ───────────────────────────────────────────

test('buildDocsUrl returns valid Google Docs URL', () => {
  assert.match(buildDocsUrl(), /docs\.google\.com/);
});

test('buildFormsUrl returns valid Google Forms URL', () => {
  assert.match(buildFormsUrl(), /docs\.google\.com\/forms/);
});

test('buildKeepUrl returns valid Google Keep URL', () => {
  assert.match(buildKeepUrl(), /keep\.google\.com/);
});

// ─── Gemini AI Tests ────────────────────────────────────────────────────────────

test('buildGeminiPrompt generates contextual prompt', () => {
  const prompt = buildGeminiPrompt({ totalKg: 600, topCategory: 'home' });
  assert.match(prompt, /carbon coach/i);
  assert.match(prompt, /600/);
  assert.match(prompt, /home/);
  assert.match(prompt, /7 days/);
});

test('buildGeminiPrompt sanitizes injection attempts', () => {
  const prompt = buildGeminiPrompt({ topCategory: '<script>hack</script>' });
  assert.equal(prompt.includes('<script>'), false);
});

test('buildDetailedGeminiPrompt includes breakdown', () => {
  const prompt = buildDetailedGeminiPrompt({
    footprint: { totalKg: 500, breakdown: { home: 100, transport: 200, food: 100, consumption: 100 } },
    score: { rank: 'Carbon Climber' },
    profile: { household: 3, commuteMode: 'car', goal: 'save money' },
  });
  assert.match(prompt, /500/);
  assert.match(prompt, /Carbon Climber/);
  assert.match(prompt, /save money/);
});

// ─── Tool Selector Tests ────────────────────────────────────────────────────────

test('getToolForCategory maps all known categories', () => {
  assert.match(getToolForCategory('home'), /Nest|Home/i);
  assert.match(getToolForCategory('transport'), /Maps/i);
  assert.match(getToolForCategory('food'), /Search/i);
  assert.match(getToolForCategory('consumption'), /Shopping/i);
});

test('getToolForCategory defaults to Google Search', () => {
  assert.match(getToolForCategory('unknown'), /Search/i);
});

// ─── Integration Tests ──────────────────────────────────────────────────────────

test('getAllToolIntegrations returns 12 tool objects', () => {
  const tools = getAllToolIntegrations({ origin: 'A', destination: 'B', totalKg: 400 });
  assert.ok(tools.length >= 12);
  tools.forEach((tool) => {
    assert.ok(tool.name, 'Each tool must have a name');
    assert.ok(tool.url, 'Each tool must have a URL');
    assert.ok(tool.description, 'Each tool must have a description');
    assert.ok(tool.icon, 'Each tool must have an icon');
  });
});

test('All tool URLs start with https://', () => {
  const tools = getAllToolIntegrations();
  tools.forEach((tool) => {
    assert.match(tool.url, /^https:\/\//, `${tool.name} URL must start with https://`);
  });
});
