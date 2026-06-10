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

// ─── Emission Factors (kg CO₂e per unit) ───────────────────────────────────────
/** @type {Readonly<Record<string, number>>} */
const FACTORS = Object.freeze({
  electricityKwh: 0.42,      // Global average grid intensity
  gasTherms: 5.3,            // Natural gas combustion
  carKm: 0.62,               // Average passenger vehicle
  transitKm: 0.02,           // Public transit (bus/metro)
  flightsShort: 39,          // Short-haul (<1500 km) per flight
  flightsLong: 260,          // Long-haul (>1500 km) per flight
  meatMeals: 6.5,            // Red meat meal average
  dairyMeals: 2,             // Dairy-heavy meal
  shoppingSpend: 1.0653,     // Embedded emissions per dollar spent
});

// ─── Google Tool Mapping ────────────────────────────────────────────────────────
/** @type {Readonly<Record<string, string>>} */
const GOOGLE_TOOLS = Object.freeze({
  home: 'Google Home / Nest Renew',
  transport: 'Google Maps',
  food: 'Google Search',
  consumption: 'Google Shopping',
});

// ─── Category Colors for Charts ─────────────────────────────────────────────────
/** @type {Readonly<Record<string, string>>} */
export const CATEGORY_COLORS = Object.freeze({
  home: '#34d399',
  transport: '#60a5fa',
  food: '#fbbf24',
  consumption: '#a78bfa',
});

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
 * Prevents XSS and injection attacks in rendered content.
 * @param {string} [value=''] - The raw input string.
 * @returns {string} Cleaned, trimmed string.
 */
export function sanitizeText(value = '') {
  return String(value)
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Core Calculation ───────────────────────────────────────────────────────────

/**
 * Calculate monthly carbon footprint from user input.
 * @param {Object} input - User's monthly consumption data.
 * @returns {{ totalKg: number, breakdown: Record<string, number>, unit: string, perCapita: number }}
 */
export function calculateFootprint(input = {}) {
  const home =
    number(input.electricityKwh) * FACTORS.electricityKwh +
    number(input.gasTherms) * FACTORS.gasTherms;
  const transport =
    number(input.carKm) * FACTORS.carKm +
    number(input.transitKm) * FACTORS.transitKm +
    number(input.flightsShort) * FACTORS.flightsShort +
    number(input.flightsLong) * FACTORS.flightsLong;
  const food =
    number(input.meatMeals) * FACTORS.meatMeals +
    number(input.dairyMeals) * FACTORS.dairyMeals;
  const consumption = number(input.shoppingSpend) * FACTORS.shoppingSpend;

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
 * @param {number} totalKg - Total monthly emissions in kg CO₂e.
 * @returns {{ rank: string, message: string, color: string, emoji: string }}
 */
export function classifyScore(totalKg = 0) {
  if (totalKg <= 350) {
    return {
      rank: 'Planet Protector',
      message: 'Excellent! Your footprint is well below global average. Keep sharing your habits and mentoring others.',
      color: 'green',
      emoji: '🌿',
    };
  }
  if (totalKg <= 800) {
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
 * @param {Record<string, number>} breakdown
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
 * @param {number} totalKg - Monthly emissions in kg CO₂e.
 * @returns {Object} Comparison equivalents.
 */
export function buildComparisons(totalKg = 0) {
  const yearlyKg = totalKg * 12;
  return {
    treesNeeded: Math.ceil(yearlyKg / 22),          // 1 tree absorbs ~22 kg/year
    equivalentCarKm: Math.round(totalKg / 0.62),     // car km equivalent
    equivalentFlights: round1(totalKg / 39),          // short flights
    vsGlobalAverage: `${Math.round((totalKg / 333) * 100)}%`, // 333 kg/month global avg
    lightbulbHours: Math.round(totalKg / 0.042),      // 100W bulb at 0.42 kg/kWh
    beefBurgers: Math.round(totalKg / 6.5),           // ~6.5 kg CO₂ per burger
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
 * @param {Object} params
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
  return `https://www.google.com/maps/dir/?api=1&origin=${safeOrigin}&destination=${safeDestination}&travelmode=transit`;
}

/**
 * Format an ISO date string to compact Google Calendar format.
 * @param {string} isoString - ISO 8601 date string.
 * @returns {string} Compact date (YYYYMMDDTHHmmssZ).
 */
function compactDate(isoString) {
  return new Date(isoString).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Build a Google Calendar event creation URL.
 * @param {Object} params - Event parameters.
 * @returns {string} Calendar URL.
 */
export function buildGoogleCalendarUrl({ title, details, start, end }) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: sanitizeText(title || 'Carbon footprint review'),
    details: sanitizeText(details || 'Review footprint dashboard and choose one action.'),
    dates: `${compactDate(start || new Date().toISOString())}/${compactDate(end || new Date(Date.now() + 1800000).toISOString())}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Build a Google Search URL for category-specific queries.
 * @param {string} category - Emission category.
 * @returns {string} Google Search URL.
 */
export function buildGoogleSearchUrl(category = 'transport') {
  const queries = {
    home: 'home energy audit tips reduce electricity bill',
    transport: 'low carbon commute alternatives public transit cycling',
    food: 'plant based recipes easy budget friendly sustainable',
    consumption: 'eco friendly sustainable products secondhand alternatives',
  };
  const query = queries[category] || queries.transport;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

// ─── Data Export ────────────────────────────────────────────────────────────────

/**
 * Sanitize a cell value for CSV export, preventing formula injection.
 * @param {*} value - Cell value.
 * @returns {string} Safe CSV cell.
 */
function csvCell(value) {
  let text = sanitizeText(value ?? '');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Build CSV content for Google Sheets import.
 * @param {Array<{category: string, kg: number, note: string}>} rows - Data rows.
 * @returns {string} CSV string with headers.
 */
export function buildGoogleSheetCsv(rows = []) {
  const header = ['category', 'kg', 'note'];
  const lines = [header.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(header.map((key) => csvCell(row[key])).join(','));
  }
  return lines.join('\n');
}

// ─── Gemini AI Prompt ───────────────────────────────────────────────────────────

/**
 * Generate a context-aware prompt for Gemini AI carbon coaching.
 * @param {Object} params - Context parameters.
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
  return GOOGLE_TOOLS[category] ?? 'Google Search';
}

// ─── Pledge System ──────────────────────────────────────────────────────────────

const PLEDGE_STORAGE_KEY = 'carbon-compass-pledges';
const HISTORY_STORAGE_KEY = 'carbon-compass-history';

/**
 * Load pledges from localStorage.
 * @returns {Array<{id: string, text: string, completed: boolean, createdAt: string}>}
 */
export function loadPledges() {
  try {
    const data = localStorage.getItem(PLEDGE_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Save pledges to localStorage.
 * @param {Array} pledges - Array of pledge objects.
 */
export function savePledges(pledges) {
  try {
    localStorage.setItem(PLEDGE_STORAGE_KEY, JSON.stringify(pledges));
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
 * @returns {Array} Updated pledges.
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
 * @returns {Array} Updated pledges.
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
    // Keep last 50 assessments max
    if (history.length > 50) history.length = 50;
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Storage full — fail silently
  }
}

/**
 * Load assessment history from localStorage.
 * @returns {Array}
 */
export function loadHistory() {
  try {
    const data = localStorage.getItem(HISTORY_STORAGE_KEY);
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
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch {
    // Fail silently
  }
}
