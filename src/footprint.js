/**
 * @fileoverview Carbon Compass — Core Footprint Calculation Engine
 *
 * Pure, testable functions for carbon footprint estimation, scoring,
 * action plan generation, and Google tool URL construction.
 *
 * All emission factors are sourced from publicly available datasets:
 * - EPA GHG Emission Factors Hub (2024)
 * - DEFRA Conversion Factors (2024)
 * - Our World in Data
 *
 * @module footprint
 * @license MIT
 */

import {
  EMISSION_FACTORS,
  SCORE_THRESHOLDS,
  COMPARISON_CONSTANTS,
  CATEGORY_GOOGLE_TOOLS,
  CATEGORY_COLORS as COLORS,
  GOOGLE_BASE_URLS,
  LIMITS,
  STORAGE_KEYS,
} from './config.js';

import { sanitizeHtml, escapeCsvCell } from './security.js';

// Re-export CATEGORY_COLORS for consumers that depend on this module
export const CATEGORY_COLORS = COLORS;

// ─── Utility Functions ──────────────────────────────────────────────────────────

/**
 * Safely parse a value to a non-negative finite number.
 * @param {*} value - The value to parse.
 * @returns {number} A non-negative number, or 0 if invalid.
 */
function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * Round a number to one decimal place.
 * @param {number} value - The number to round.
 * @returns {number}
 */
function round1(value) {
  return Math.round(value * 10) / 10;
}

/**
 * Sanitize user input by stripping HTML tags and control characters.
 * Delegates to the security module for defense-in-depth.
 * @param {string} [value=''] - The raw input string.
 * @returns {string} Cleaned, trimmed string.
 */
export function sanitizeText(value = '') {
  return sanitizeHtml(value);
}

// ─── Core Calculation ───────────────────────────────────────────────────────────

/**
 * Calculate monthly carbon footprint from user input.
 * @param {Object} input - User's monthly consumption data.
 * @param {number} [input.electricityKwh=0] - Monthly electricity in kWh.
 * @param {number} [input.gasTherms=0] - Monthly natural gas in therms.
 * @param {number} [input.carKm=0] - Monthly car travel in km.
 * @param {number} [input.transitKm=0] - Monthly transit travel in km.
 * @param {number} [input.flightsShort=0] - Short-haul flights per month.
 * @param {number} [input.flightsLong=0] - Long-haul flights per month.
 * @param {number} [input.meatMeals=0] - Meat meals per month.
 * @param {number} [input.dairyMeals=0] - Dairy meals per month.
 * @param {number} [input.shoppingSpend=0] - Monthly shopping spend in $.
 * @param {number} [input.household=1] - Household size.
 * @returns {{ totalKg: number, breakdown: Record<string, number>, unit: string, perCapita: number }}
 */
export function calculateFootprint(input = {}) {
  const home =
    number(input.electricityKwh) * EMISSION_FACTORS.electricityKwh +
    number(input.gasTherms) * EMISSION_FACTORS.gasTherms;
  const transport =
    number(input.carKm) * EMISSION_FACTORS.carKm +
    number(input.transitKm) * EMISSION_FACTORS.transitKm +
    number(input.flightsShort) * EMISSION_FACTORS.flightsShort +
    number(input.flightsLong) * EMISSION_FACTORS.flightsLong;
  const food =
    number(input.meatMeals) * EMISSION_FACTORS.meatMeals +
    number(input.dairyMeals) * EMISSION_FACTORS.dairyMeals;
  const consumption = number(input.shoppingSpend) * EMISSION_FACTORS.shoppingSpend;

  const breakdown = {
    home: round1(home),
    transport: round1(transport),
    food: round1(food),
    consumption: round1(consumption),
  };

  const totalKg = round1(Object.values(breakdown).reduce((sum, item) => sum + item, 0));
  const household = Math.max(1, number(input.household || 1));
  const perCapita = round1(totalKg / household);

  return { totalKg, breakdown, unit: 'kg CO2e/month', perCapita };
}

// ─── Scoring & Classification ───────────────────────────────────────────────────

/**
 * Classify a total monthly footprint into a sustainability tier.
 * Uses thresholds from config module for maintainability.
 * @param {number} totalKg - Total monthly emissions in kg CO₂e.
 * @returns {{ rank: string, message: string, color: string, emoji: string }}
 */
export function classifyScore(totalKg = 0) {
  if (totalKg <= SCORE_THRESHOLDS.GREEN) {
    return {
      rank: 'Planet Protector',
      message: 'Excellent! Your footprint is well below global average. Keep sharing your habits and mentoring others.',
      color: 'green',
      emoji: '🌿',
    };
  }
  if (totalKg <= SCORE_THRESHOLDS.AMBER) {
    return {
      rank: 'Carbon Climber',
      message: 'Good progress! One focused habit change in your top category can push you into the top tier.',
      color: 'amber',
      emoji: '🌱',
    };
  }
  return {
    rank: 'High Impact',
    message: 'Your biggest category needs a practical reduction plan this week. Start with the top action below.',
    color: 'red',
    emoji: '🔥',
  };
}

// ─── Category Ranking ───────────────────────────────────────────────────────────

/**
 * Determine the top emission category from breakdown.
 * @param {Record<string, number>} breakdown - Category emissions.
 * @returns {string} The category name with highest emissions.
 */
function topCategory(breakdown = {}) {
  return Object.entries(breakdown).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'transport';
}

/**
 * Get a sorted ranking of all categories.
 * @param {Record<string, number>} breakdown - Category emissions object.
 * @returns {Array<{category: string, kg: number, percentage: number}>}
 */
export function rankCategories(breakdown = {}) {
  const total = Object.values(breakdown).reduce((s, v) => s + v, 0) || 1;
  return Object.entries(breakdown)
    .sort((a, b) => b[1] - a[1])
    .map(([category, kg]) => ({
      category,
      kg,
      percentage: Math.round((kg / total) * 100),
    }));
}

// ─── Comparison Metrics ─────────────────────────────────────────────────────────

/**
 * Convert total emissions into relatable comparison metrics.
 * Uses named constants from config module to avoid magic numbers.
 * @param {number} totalKg - Monthly emissions in kg CO₂e.
 * @returns {Object} Comparison equivalents.
 */
export function buildComparisons(totalKg = 0) {
  const yearlyKg = totalKg * COMPARISON_CONSTANTS.MONTHS_PER_YEAR;
  return {
    treesNeeded: Math.ceil(yearlyKg / COMPARISON_CONSTANTS.TREE_ABSORPTION_KG_YEAR),
    equivalentCarKm: Math.round(totalKg / EMISSION_FACTORS.carKm),
    equivalentFlights: round1(totalKg / EMISSION_FACTORS.flightsShort),
    vsGlobalAverage: `${Math.round((totalKg / COMPARISON_CONSTANTS.GLOBAL_AVERAGE_MONTHLY_KG) * 100)}%`,
    lightbulbHours: Math.round(totalKg / COMPARISON_CONSTANTS.LIGHTBULB_CO2E_PER_KWH),
    beefBurgers: Math.round(totalKg / COMPARISON_CONSTANTS.BURGER_CO2E_KG),
  };
}

// ─── Action Plan Builder ────────────────────────────────────────────────────────

/** @type {Readonly<Record<string, Array>>} */
const PLAN_LIBRARY = Object.freeze({
  transport: [
    {
      title: 'Replace one car trip with transit, carpool, walking, or biking',
      impact: 'Cuts fuel emissions and often reduces weekly cost.',
      googleTool: 'Google Maps',
      action: 'Open a lower-carbon route and compare transit/cycling time.',
    },
    {
      title: 'Batch errands into one optimized route',
      impact: 'Fewer cold starts and fewer duplicate kilometres.',
      googleTool: 'Google Maps',
      action: 'Create a multi-stop route before leaving home.',
    },
  ],
  home: [
    {
      title: 'Schedule a 30-minute home energy audit',
      impact: 'Finds standby loads, heating/cooling waste, and lighting upgrades.',
      googleTool: 'Google Calendar',
      action: 'Add a recurring monthly energy review reminder.',
    },
    {
      title: 'Automate thermostat and device routines',
      impact: 'Cuts energy waste while keeping comfort.',
      googleTool: 'Google Home',
      action: 'Create away/sleep routines for smart plugs and thermostat.',
    },
  ],
  food: [
    {
      title: 'Plan three plant-forward meals this week',
      impact: 'Reduces meal emissions without requiring perfection.',
      googleTool: 'Google Search',
      action: 'Search recipes based on budget, time, and local ingredients.',
    },
    {
      title: 'Use Google Keep for low-waste grocery lists',
      impact: 'Avoids overbuying and food waste.',
      googleTool: 'Google Keep',
      action: 'Make a shared shopping checklist before each trip.',
    },
  ],
  consumption: [
    {
      title: 'Use a 48-hour rule before non-essential purchases',
      impact: 'Reduces impulse buying and embedded product emissions.',
      googleTool: 'Google Shopping',
      action: 'Compare durability, repairability, and second-hand options.',
    },
    {
      title: 'Track monthly purchases in a sheet',
      impact: 'Makes high-impact spending visible and measurable.',
      googleTool: 'Google Sheets',
      action: 'Export today\'s footprint CSV and update it monthly.',
    },
  ],
});

/**
 * Build a personalized action plan based on user profile and footprint.
 * Prioritizes the largest emission category and adapts to user goals.
 * @param {Object} params - Parameters for action plan generation.
 * @param {Object} params.profile - User profile with commuteMode and goal.
 * @param {Object} params.footprint - Calculated footprint with breakdown.
 * @returns {Array<Object>} Ordered list of actions.
 */
export function buildActionPlan({ profile = {}, footprint = {} } = {}) {
  const category = topCategory(footprint.breakdown);
  const preferred = PLAN_LIBRARY[category] ?? PLAN_LIBRARY.transport;
  const context = sanitizeText(`${profile.commuteMode ?? ''} ${profile.goal ?? ''}`.toLowerCase());

  const contextualPlan = preferred.map((item, index) => ({
    ...item,
    category,
    priority: index + 1,
    whyNow: context.includes('save money')
      ? 'Chosen because it can lower emissions and household costs.'
      : context.includes('health')
        ? 'Chosen because it improves both health and emissions.'
        : 'Chosen because it targets your largest emissions category.',
  }));

  return [
    ...contextualPlan,
    {
      category: 'tracking',
      priority: contextualPlan.length + 1,
      title: 'Review progress every month',
      impact: 'Small repeated improvements beat one-time pledges.',
      googleTool: 'Google Calendar + Google Sheets',
      action: 'Schedule a review and export your results to CSV.',
      whyNow: 'Measurement keeps the assistant dynamic and accountable.',
    },
  ];
}

// ─── Google Tool URL Builders ───────────────────────────────────────────────────

/**
 * Build a Google Maps transit directions URL.
 * @param {string} origin - Start location.
 * @param {string} destination - End location.
 * @returns {string} Google Maps URL.
 */
export function buildGoogleMapsTransitUrl(origin = '', destination = '') {
  const safeOrigin = encodeURIComponent(sanitizeText(origin));
  const safeDestination = encodeURIComponent(sanitizeText(destination));
  return `${GOOGLE_BASE_URLS.MAPS}?api=1&origin=${safeOrigin}&destination=${safeDestination}&travelmode=transit`;
}

/**
 * Format an ISO date string to compact Google Calendar format.
 * @param {string} isoString - ISO 8601 date string.
 * @returns {string} Compact date (YYYYMMDDTHHmmssZ).
 */
function compactDate(isoString) {
  return new Date(isoString).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** @type {number} One day in milliseconds. */
const ONE_DAY_MS = 86400000;

/** @type {number} 30 minutes in milliseconds. */
const THIRTY_MINUTES_MS = 1800000;

/**
 * Build a Google Calendar event creation URL.
 * @param {Object} params - Event parameters.
 * @param {string} [params.title] - Event title.
 * @param {string} [params.details] - Event description.
 * @param {string} [params.start] - ISO start time.
 * @param {string} [params.end] - ISO end time.
 * @returns {string} Calendar URL.
 */
export function buildGoogleCalendarUrl({ title, details, start, end }) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: sanitizeText(title || 'Carbon footprint review'),
    details: sanitizeText(details || 'Review footprint dashboard and choose one action.'),
    dates: `${compactDate(start || new Date().toISOString())}/${compactDate(end || new Date(Date.now() + THIRTY_MINUTES_MS).toISOString())}`,
  });
  return `${GOOGLE_BASE_URLS.CALENDAR}?${params.toString()}`;
}

/**
 * Build a Google Search URL for category-specific queries.
 * @param {string} category - Emission category.
 * @returns {string} Google Search URL.
 */
export function buildGoogleSearchUrl(category = 'transport') {
  /** @type {Readonly<Record<string, string>>} */
  const queries = Object.freeze({
    home: 'home energy audit tips reduce electricity bill',
    transport: 'low carbon commute alternatives public transit cycling',
    food: 'plant based recipes easy budget friendly sustainable',
    consumption: 'eco friendly sustainable products secondhand alternatives',
  });
  const query = queries[category] || queries.transport;
  return `${GOOGLE_BASE_URLS.SEARCH}?q=${encodeURIComponent(query)}`;
}

// ─── Data Export ────────────────────────────────────────────────────────────────

/**
 * Build CSV content for Google Sheets import.
 * Delegates cell sanitization to the security module.
 * @param {Array<{category: string, kg: number, note: string}>} rows - Data rows.
 * @returns {string} CSV string with headers.
 */
export function buildGoogleSheetCsv(rows = []) {
  const header = ['category', 'kg', 'note'];
  const lines = [header.map(escapeCsvCell).join(',')];
  for (const row of rows) {
    lines.push(header.map((key) => escapeCsvCell(row[key])).join(','));
  }
  return lines.join('\n');
}

// ─── Gemini AI Prompt ───────────────────────────────────────────────────────────

/**
 * Generate a context-aware prompt for Gemini AI carbon coaching.
 * @param {Object} params - Context parameters.
 * @param {number} [params.totalKg=0] - Monthly CO₂e in kg.
 * @param {string} [params.topCategory='transport'] - Highest emission category.
 * @returns {string} Gemini prompt.
 */
export function buildGeminiPrompt({ totalKg = 0, topCategory: category = 'transport' } = {}) {
  return `Act as a carbon coach. My estimated footprint is ${round1(number(totalKg))} kg CO2e/month and my top category is ${sanitizeText(category)}. Give three realistic actions for the next 7 days, prioritizing low cost, accessibility, and measurable impact. Avoid guilt; be practical.`;
}

/**
 * Get the recommended Google tool for a given emission category.
 * @param {string} category - Emission category.
 * @returns {string} Google tool name.
 */
export function getGoogleToolForCategory(category) {
  return CATEGORY_GOOGLE_TOOLS[category] ?? 'Google Search';
}

// ─── Pledge System ──────────────────────────────────────────────────────────────

/**
 * Load pledges from localStorage.
 * @returns {Array<{id: string, text: string, completed: boolean, createdAt: string}>}
 */
export function loadPledges() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PLEDGES);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Save pledges to localStorage.
 * @param {Array<Object>} pledges - Array of pledge objects.
 */
export function savePledges(pledges) {
  try {
    localStorage.setItem(STORAGE_KEYS.PLEDGES, JSON.stringify(pledges));
  } catch {
    // Storage full or unavailable — fail silently
  }
}

/**
 * Add a new pledge.
 * @param {string} text - Pledge text.
 * @returns {Object} The new pledge object.
 */
export function addPledge(text) {
  const pledges = loadPledges();
  const pledge = {
    id: `pledge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: sanitizeText(text),
    completed: false,
    createdAt: new Date().toISOString(),
  };
  pledges.unshift(pledge);
  savePledges(pledges);
  return pledge;
}

/**
 * Toggle a pledge's completion status.
 * @param {string} id - Pledge ID.
 * @returns {Array<Object>} Updated pledges.
 */
export function togglePledge(id) {
  const pledges = loadPledges();
  const pledge = pledges.find((p) => p.id === id);
  if (pledge) pledge.completed = !pledge.completed;
  savePledges(pledges);
  return pledges;
}

/**
 * Delete a pledge.
 * @param {string} id - Pledge ID.
 * @returns {Array<Object>} Updated pledges.
 */
export function deletePledge(id) {
  const pledges = loadPledges().filter((p) => p.id !== id);
  savePledges(pledges);
  return pledges;
}

// ─── Assessment History ─────────────────────────────────────────────────────────

/**
 * Save an assessment to history.
 * @param {Object} assessment - Assessment data.
 */
export function saveToHistory(assessment) {
  try {
    const history = loadHistory();
    history.unshift({
      ...assessment,
      timestamp: new Date().toISOString(),
    });
    // Keep history within configured limit
    if (history.length > LIMITS.MAX_HISTORY_ENTRIES) {
      history.length = LIMITS.MAX_HISTORY_ENTRIES;
    }
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
  } catch {
    // Storage full — fail silently
  }
}

/**
 * Load assessment history from localStorage.
 * @returns {Array<Object>}
 */
export function loadHistory() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Clear all assessment history.
 */
export function clearHistory() {
  try {
    localStorage.removeItem(STORAGE_KEYS.HISTORY);
  } catch {
    // Fail silently
  }
}
