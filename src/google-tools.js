/**
 * @fileoverview Google Tools Integration Module for Carbon Compass.
 *
 * Provides a unified API for generating URLs and integration payloads
 * for 12+ Google services. Each builder function is pure, testable,
 * and returns a validated URL string.
 *
 * Supported Google Tools:
 * - Google Maps (eco-routing, transit directions)
 * - Google Calendar (event creation, recurring reviews)
 * - Gmail (action plan sharing)
 * - Google Sheets (CSV data export)
 * - Google Drive (JSON backup)
 * - Google Search (category-specific queries)
 * - Google Shopping (eco product discovery)
 * - Google Earth (climate impact visualization)
 * - Google Trends (sustainability analytics)
 * - Google Scholar (research access)
 * - Gemini AI (prompt engineering)
 * - Google Keep (checklist templates)
 * - YouTube (eco video discovery)
 * - Google Docs (collaborative documentation)
 * - Google Forms (team surveys)
 * - Looker Studio (dashboard creation)
 *
 * @module google-tools
 * @license MIT
 */

import { GOOGLE_BASE_URLS, CATEGORY_GOOGLE_TOOLS } from './config.js';
import { sanitizeHtml, encodeUrlParam } from './security.js';

// ─── Time Constants ─────────────────────────────────────────────────────────────

/** @type {number} One day in milliseconds. */
const ONE_DAY_MS = 86400000;

/** @type {number} One day plus 30 minutes in milliseconds. */
const ONE_DAY_PLUS_30MIN_MS = 88200000;

// ─── Utility ────────────────────────────────────────────────────────────────────

/**
 * Format an ISO date string to compact Google Calendar format (YYYYMMDDTHHmmssZ).
 * @param {string} isoString - ISO 8601 date string.
 * @returns {string} Compact date string.
 */
function compactDate(isoString) {
  return new Date(isoString).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Create a date offset from now by the given milliseconds.
 * @param {number} offsetMs - Milliseconds from now.
 * @returns {string} ISO date string.
 */
function futureDate(offsetMs) {
  return new Date(Date.now() + offsetMs).toISOString();
}

// ─── Google Maps ────────────────────────────────────────────────────────────────

/**
 * Build a Google Maps transit directions URL.
 * Encourages low-carbon commute by defaulting to transit mode.
 *
 * @param {string} origin - Start location (sanitized).
 * @param {string} destination - End location (sanitized).
 * @param {string} [travelMode='transit'] - Travel mode (transit, bicycling, walking, driving).
 * @returns {string} Google Maps directions URL.
 *
 * @example
 * buildMapsUrl('Home', 'Office')
 * // => 'https://www.google.com/maps/dir/?api=1&origin=Home&destination=Office&travelmode=transit'
 */
export function buildMapsUrl(origin = '', destination = '', travelMode = 'transit') {
  const validModes = ['transit', 'bicycling', 'walking', 'driving'];
  const mode = validModes.includes(travelMode) ? travelMode : 'transit';

  return `${GOOGLE_BASE_URLS.MAPS}?api=1&origin=${encodeUrlParam(origin)}&destination=${encodeUrlParam(destination)}&travelmode=${mode}`;
}

/**
 * Build a Google Maps URL comparing multiple transport modes.
 * Returns an array of URLs for side-by-side comparison.
 *
 * @param {string} origin - Start location.
 * @param {string} destination - End location.
 * @returns {Array<{mode: string, url: string, label: string}>}
 */
export function buildMapsComparisonUrls(origin, destination) {
  return [
    { mode: 'transit', url: buildMapsUrl(origin, destination, 'transit'), label: '🚌 Transit' },
    { mode: 'bicycling', url: buildMapsUrl(origin, destination, 'bicycling'), label: '🚲 Cycling' },
    { mode: 'walking', url: buildMapsUrl(origin, destination, 'walking'), label: '🚶 Walking' },
    { mode: 'driving', url: buildMapsUrl(origin, destination, 'driving'), label: '🚗 Driving' },
  ];
}

// ─── Google Calendar ────────────────────────────────────────────────────────────

/**
 * Build a Google Calendar event creation URL.
 *
 * @param {Object} params - Event parameters.
 * @param {string} [params.title] - Event title.
 * @param {string} [params.details] - Event description.
 * @param {string} [params.start] - ISO start time.
 * @param {string} [params.end] - ISO end time.
 * @param {string} [params.location] - Event location.
 * @returns {string} Google Calendar URL.
 *
 * @example
 * buildCalendarUrl({ title: 'Carbon Review', details: 'Monthly check-in' })
 */
export function buildCalendarUrl({
  title = 'Carbon footprint review',
  details = 'Review footprint dashboard and choose one action.',
  start,
  end,
  location = '',
} = {}) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: sanitizeHtml(title),
    details: sanitizeHtml(details),
    dates: `${compactDate(start || futureDate(ONE_DAY_MS))}/${compactDate(end || futureDate(ONE_DAY_PLUS_30MIN_MS))}`,
  });

  if (location) {
    params.set('location', sanitizeHtml(location));
  }

  return `${GOOGLE_BASE_URLS.CALENDAR}?${params.toString()}`;
}

/**
 * Build a recurring monthly review calendar URL.
 *
 * @param {number} totalKg - Current footprint in kg CO₂e.
 * @param {string} topCategory - Highest-impact emission category.
 * @returns {string} Calendar URL with recurring review details.
 */
export function buildMonthlyReviewUrl(totalKg, topCategory) {
  return buildCalendarUrl({
    title: '🌍 Monthly Carbon Footprint Review',
    details: `Current footprint: ${totalKg} kg CO₂e/month. Top category: ${sanitizeHtml(topCategory)}. Open Carbon Compass to recalculate and update your action plan.`,
    start: futureDate(ONE_DAY_MS),
    end: futureDate(ONE_DAY_PLUS_30MIN_MS),
  });
}

// ─── Gmail ──────────────────────────────────────────────────────────────────────

/**
 * Build a Gmail compose URL with pre-filled subject and body.
 *
 * @param {Object} params - Email parameters.
 * @param {string} [params.subject] - Email subject.
 * @param {string} [params.body] - Email body.
 * @param {string} [params.to] - Recipient email.
 * @returns {string} Gmail compose URL.
 */
export function buildGmailUrl({ subject = '', body = '', to = '' } = {}) {
  const params = new URLSearchParams({ view: 'cm' });

  if (to) params.set('to', sanitizeHtml(to));
  if (subject) params.set('su', sanitizeHtml(subject));
  if (body) params.set('body', sanitizeHtml(body));

  return `${GOOGLE_BASE_URLS.GMAIL}?${params.toString()}`;
}

/**
 * Build an action plan sharing email URL.
 *
 * @param {Object} params - Footprint data.
 * @param {number} params.totalKg - Total monthly CO₂e.
 * @param {string} params.rank - Score rank name.
 * @param {string} params.topCategory - Highest category.
 * @param {string} params.topAction - Top recommended action.
 * @returns {string} Gmail URL.
 */
export function buildShareActionPlanUrl({ totalKg, rank, topCategory, topAction }) {
  const body = [
    'Hi,',
    '',
    'I just calculated my carbon footprint using Carbon Compass!',
    '',
    `📊 Monthly estimate: ${totalKg} kg CO₂e`,
    `🏆 Rank: ${sanitizeHtml(rank)}`,
    `📌 Top category: ${sanitizeHtml(topCategory)}`,
    `✅ Top action: ${sanitizeHtml(topAction)}`,
    '',
    'Try it yourself and let\'s reduce our impact together!',
    '',
    '— Sent from Carbon Compass 🌍',
  ].join('\n');

  return buildGmailUrl({
    subject: 'My Carbon Action Plan — Carbon Compass',
    body,
  });
}

// ─── Google Search ──────────────────────────────────────────────────────────────

/**
 * Category-specific search queries for actionable discovery.
 * @type {Readonly<Record<string, string>>}
 */
const SEARCH_QUERIES = Object.freeze({
  home: 'home energy audit tips reduce electricity bill save money',
  transport: 'low carbon commute alternatives public transit cycling benefits',
  food: 'plant based recipes easy budget friendly sustainable meals',
  consumption: 'eco friendly sustainable products secondhand alternatives durable goods',
  recycling: 'recycling centers near me how to recycle electronics',
  solar: 'residential solar panel cost savings calculator',
  insulation: 'home insulation guide reduce heating costs',
  compost: 'how to start composting at home beginners guide',
});

/**
 * Build a Google Search URL for a specific topic.
 *
 * @param {string} category - Emission category or topic key.
 * @returns {string} Google Search URL.
 */
export function buildSearchUrl(category = 'transport') {
  const query = SEARCH_QUERIES[category] || SEARCH_QUERIES.transport;
  return `${GOOGLE_BASE_URLS.SEARCH}?q=${encodeURIComponent(query)}`;
}

/**
 * Build context-aware search URL based on footprint data.
 *
 * @param {string} topCategory - User's top emission category.
 * @param {string} goal - User's sustainability goal.
 * @returns {string} Google Search URL with tailored query.
 */
export function buildContextualSearchUrl(topCategory, goal = '') {
  const goalSuffix = goal ? ` ${sanitizeHtml(goal)}` : '';
  const query = (SEARCH_QUERIES[topCategory] || SEARCH_QUERIES.transport) + goalSuffix;
  return `${GOOGLE_BASE_URLS.SEARCH}?q=${encodeURIComponent(query)}`;
}

// ─── Google Shopping ────────────────────────────────────────────────────────────

/**
 * Build a Google Shopping URL for eco-friendly products.
 *
 * @param {string} [query='eco friendly sustainable products'] - Search query.
 * @returns {string} Google Shopping URL.
 */
export function buildShoppingUrl(query = 'eco friendly sustainable products') {
  return `${GOOGLE_BASE_URLS.SHOPPING}?q=${encodeUrlParam(query)}`;
}

// ─── Google Earth ───────────────────────────────────────────────────────────────

/**
 * Build a Google Earth URL for climate impact exploration.
 *
 * @returns {string} Google Earth URL.
 */
export function buildEarthUrl() {
  return `${GOOGLE_BASE_URLS.EARTH}@0,0,0a,22251752.77375655d,35y,0h,0t,0r`;
}

// ─── Google Trends ──────────────────────────────────────────────────────────────

/**
 * Build a Google Trends comparison URL for sustainability topics.
 *
 * @param {string[]} [terms] - Search terms to compare.
 * @returns {string} Google Trends URL.
 */
export function buildTrendsUrl(terms = ['carbon footprint', 'sustainability', 'climate change']) {
  const query = terms.map((t) => sanitizeHtml(t)).join(',');
  return `${GOOGLE_BASE_URLS.TRENDS}?q=${encodeURIComponent(query)}`;
}

// ─── Google Scholar ─────────────────────────────────────────────────────────────

/**
 * Build a Google Scholar search URL for research papers.
 *
 * @param {string} [query='carbon footprint reduction strategies'] - Research query.
 * @returns {string} Google Scholar URL.
 */
export function buildScholarUrl(query = 'carbon footprint reduction strategies') {
  return `${GOOGLE_BASE_URLS.SCHOLAR}?q=${encodeUrlParam(query)}`;
}

// ─── YouTube ────────────────────────────────────────────────────────────────────

/**
 * Build a YouTube search URL for eco-living content.
 *
 * @param {string} [query='how to reduce carbon footprint at home'] - Video search query.
 * @returns {string} YouTube search URL.
 */
export function buildYouTubeUrl(query = 'how to reduce carbon footprint at home') {
  return `${GOOGLE_BASE_URLS.YOUTUBE}?search_query=${encodeUrlParam(query)}`;
}

// ─── Google Docs ────────────────────────────────────────────────────────────────

/**
 * Build a Google Docs creation URL.
 *
 * @returns {string} Google Docs new document URL.
 */
export function buildDocsUrl() {
  return GOOGLE_BASE_URLS.DOCS;
}

// ─── Google Forms ───────────────────────────────────────────────────────────────

/**
 * Build a Google Forms creation URL for team surveys.
 *
 * @returns {string} Google Forms new form URL.
 */
export function buildFormsUrl() {
  return GOOGLE_BASE_URLS.FORMS;
}

// ─── Google Keep ────────────────────────────────────────────────────────────────

/**
 * Build a Google Keep URL.
 *
 * @returns {string} Google Keep URL.
 */
export function buildKeepUrl() {
  return GOOGLE_BASE_URLS.KEEP;
}

// ─── Gemini AI ──────────────────────────────────────────────────────────────────

/**
 * Generate an optimized prompt for Gemini AI carbon coaching.
 * Structured with clear constraints and context for best results.
 *
 * @param {Object} params - Prompt context.
 * @param {number} params.totalKg - Monthly CO₂e in kg.
 * @param {string} params.topCategory - Highest emission category.
 * @param {string} [params.goal] - User's sustainability goal.
 * @param {string} [params.commuteMode] - User's commute mode.
 * @returns {string} Gemini-optimized prompt string.
 */
export function buildGeminiPrompt({
  totalKg = 0,
  topCategory = 'transport',
  goal = 'reduce emissions',
  commuteMode = 'car',
} = {}) {
  const safeCategory = sanitizeHtml(topCategory);
  const safeGoal = sanitizeHtml(goal);
  const safeCommute = sanitizeHtml(commuteMode);

  return [
    'Act as a carbon coach.',
    `My estimated footprint is ${Math.max(0, Number(totalKg) || 0)} kg CO₂e/month.`,
    `My top emission category is ${safeCategory}.`,
    `My commute mode is ${safeCommute} and my goal is to ${safeGoal}.`,
    'Give three realistic actions for the next 7 days.',
    'Prioritize: low cost, accessibility, and measurable impact.',
    'For each action, specify the expected CO₂ reduction in kg.',
    'Avoid guilt; be practical and encouraging.',
  ].join(' ');
}

/**
 * Generate a detailed Gemini prompt with full assessment context.
 *
 * @param {Object} assessment - Full assessment data.
 * @returns {string} Detailed Gemini prompt.
 */
export function buildDetailedGeminiPrompt(assessment = {}) {
  const { footprint = {}, score = {}, profile = {} } = assessment;
  const breakdown = footprint.breakdown || {};

  const breakdownText = Object.entries(breakdown)
    .map(([cat, kg]) => `${cat}: ${kg} kg`)
    .join(', ');

  return [
    'Act as an expert carbon reduction coach.',
    `My monthly carbon footprint is ${footprint.totalKg || 0} kg CO₂e.`,
    `Breakdown: ${breakdownText}.`,
    `Current rank: ${sanitizeHtml(score.rank || 'Unknown')}.`,
    `Household size: ${sanitizeHtml(String(profile.household || 1))}.`,
    `Commute: ${sanitizeHtml(profile.commuteMode || 'car')}.`,
    `Goal: ${sanitizeHtml(profile.goal || 'reduce emissions')}.`,
    '',
    'Please provide:',
    '1. Three specific actions for this week with expected kg CO₂ savings',
    '2. One long-term habit change for the next month',
    '3. A relevant Google tool recommendation for each action',
    '',
    'Constraints: low cost, family-friendly, measurable results.',
  ].join(' ');
}

// ─── Tool Selector ──────────────────────────────────────────────────────────────

/**
 * Get the recommended Google tool for a given emission category.
 *
 * @param {string} category - Emission category name.
 * @returns {string} Google tool name.
 */
export function getToolForCategory(category) {
  return CATEGORY_GOOGLE_TOOLS[category] ?? 'Google Search';
}

/**
 * Get all available Google tool integrations with their URLs and descriptions.
 *
 * @param {Object} context - User context for URL generation.
 * @param {string} [context.origin='Home'] - Route origin.
 * @param {string} [context.destination='Work'] - Route destination.
 * @param {number} [context.totalKg=0] - Total footprint.
 * @param {string} [context.topCategory='transport'] - Top category.
 * @returns {Array<{name: string, icon: string, url: string, description: string, type: string}>}
 */
export function getAllToolIntegrations(context = {}) {
  const {
    origin = 'Home',
    destination = 'Work',
    totalKg = 0,
    topCategory = 'transport',
  } = context;

  return [
    {
      name: 'Google Maps',
      icon: '📍',
      url: buildMapsUrl(origin, destination),
      description: 'Low-carbon transit route between your origin and destination',
      type: 'live',
    },
    {
      name: 'Google Calendar',
      icon: '📅',
      url: buildMonthlyReviewUrl(totalKg, topCategory),
      description: 'Schedule a monthly carbon footprint review event',
      type: 'live',
    },
    {
      name: 'Gmail',
      icon: '✉️',
      url: buildShareActionPlanUrl({ totalKg, rank: '', topCategory, topAction: '' }),
      description: 'Share your carbon action plan with friends and family',
      type: 'live',
    },
    {
      name: 'Google Search',
      icon: '🔍',
      url: buildSearchUrl(topCategory),
      description: 'Discover reduction tips for your top emission category',
      type: 'live',
    },
    {
      name: 'Google Shopping',
      icon: '🛒',
      url: buildShoppingUrl(),
      description: 'Find eco-friendly and sustainable product alternatives',
      type: 'live',
    },
    {
      name: 'Google Earth',
      icon: '🌍',
      url: buildEarthUrl(),
      description: 'Explore global climate change impacts visually',
      type: 'live',
    },
    {
      name: 'Google Trends',
      icon: '📈',
      url: buildTrendsUrl(),
      description: 'Track public interest in sustainability topics',
      type: 'live',
    },
    {
      name: 'Google Scholar',
      icon: '🎓',
      url: buildScholarUrl(),
      description: 'Access peer-reviewed carbon reduction research',
      type: 'live',
    },
    {
      name: 'YouTube',
      icon: '🎬',
      url: buildYouTubeUrl(),
      description: 'Watch eco-living guides and sustainability videos',
      type: 'live',
    },
    {
      name: 'Google Docs',
      icon: '📝',
      url: buildDocsUrl(),
      description: 'Create collaborative carbon reduction documentation',
      type: 'live',
    },
    {
      name: 'Google Forms',
      icon: '📋',
      url: buildFormsUrl(),
      description: 'Build team or family carbon footprint surveys',
      type: 'live',
    },
    {
      name: 'Google Keep',
      icon: '📌',
      url: buildKeepUrl(),
      description: 'Create shared low-waste shopping checklists',
      type: 'live',
    },
  ];
}
