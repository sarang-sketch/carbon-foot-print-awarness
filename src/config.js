/**
 * @fileoverview Application configuration constants.
 *
 * Centralizes all configurable values into a single frozen module.
 * Using Object.freeze ensures immutability at runtime.
 * All magic numbers and thresholds are documented here.
 *
 * @module config
 * @license MIT
 */

// ─── Emission Factors ───────────────────────────────────────────────────────────
// Source: EPA GHG Emission Factors Hub (2024), DEFRA Conversion Factors (2024)

/**
 * CO₂e emission factors per unit of activity.
 * @type {Readonly<Record<string, number>>}
 */
export const EMISSION_FACTORS = Object.freeze({
  /** kg CO₂e per kWh of electricity (global grid average) */
  electricityKwh: 0.42,
  /** kg CO₂e per therm of natural gas */
  gasTherms: 5.3,
  /** kg CO₂e per km driven in an average passenger vehicle */
  carKm: 0.62,
  /** kg CO₂e per km on public transit (bus/metro average) */
  transitKm: 0.02,
  /** kg CO₂e per short-haul flight (<1500 km) */
  flightsShort: 39,
  /** kg CO₂e per long-haul flight (>1500 km) */
  flightsLong: 260,
  /** kg CO₂e per meat-based meal (red meat average) */
  meatMeals: 6.5,
  /** kg CO₂e per dairy-heavy meal */
  dairyMeals: 2,
  /** kg CO₂e per dollar of non-essential spending */
  shoppingSpend: 1.0653,
});

// ─── Scoring Thresholds ─────────────────────────────────────────────────────────

/**
 * Monthly CO₂e thresholds (in kg) for classification tiers.
 * @type {Readonly<{GREEN: number, AMBER: number}>}
 */
export const SCORE_THRESHOLDS = Object.freeze({
  /** Maximum kg for "Planet Protector" tier */
  GREEN: 350,
  /** Maximum kg for "Carbon Climber" tier */
  AMBER: 800,
});

// ─── Comparison Constants ───────────────────────────────────────────────────────

/**
 * Constants used for tangible comparisons.
 * @type {Readonly<Record<string, number>>}
 */
export const COMPARISON_CONSTANTS = Object.freeze({
  /** kg CO₂ absorbed by one mature tree per year */
  TREE_ABSORPTION_KG_YEAR: 22,
  /** Global average monthly CO₂e per person (kg) */
  GLOBAL_AVERAGE_MONTHLY_KG: 333,
  /** kg CO₂e per average beef burger */
  BURGER_CO2E_KG: 6.5,
  /** kg CO₂e per kWh (for lightbulb calculation) */
  LIGHTBULB_CO2E_PER_KWH: 0.042,
  /** Months in a year */
  MONTHS_PER_YEAR: 12,
});

// ─── Google Tool Mapping ────────────────────────────────────────────────────────

/**
 * Maps emission categories to their most relevant Google tool.
 * @type {Readonly<Record<string, string>>}
 */
export const CATEGORY_GOOGLE_TOOLS = Object.freeze({
  home: 'Google Home / Nest Renew',
  transport: 'Google Maps',
  food: 'Google Search',
  consumption: 'Google Shopping',
});

// ─── Category Visualization ─────────────────────────────────────────────────────

/**
 * Hex color codes for each emission category (chart rendering).
 * @type {Readonly<Record<string, string>>}
 */
export const CATEGORY_COLORS = Object.freeze({
  home: '#34d399',
  transport: '#60a5fa',
  food: '#fbbf24',
  consumption: '#a78bfa',
});

/**
 * Human-readable labels for each emission category.
 * @type {Readonly<Record<string, string>>}
 */
export const CATEGORY_LABELS = Object.freeze({
  home: 'Home Energy',
  transport: 'Transport',
  food: 'Food & Diet',
  consumption: 'Shopping & Consumption',
});

// ─── Storage Keys ───────────────────────────────────────────────────────────────

/**
 * localStorage key names used by the application.
 * Centralizing prevents key collision and typo bugs.
 * @type {Readonly<Record<string, string>>}
 */
export const STORAGE_KEYS = Object.freeze({
  PLEDGES: 'carbon-compass-pledges',
  HISTORY: 'carbon-compass-history',
  PREFERENCES: 'carbon-compass-preferences',
  THEME: 'carbon-compass-theme',
});

// ─── Application Limits ─────────────────────────────────────────────────────────

/**
 * Application limits and constraints.
 * @type {Readonly<Record<string, number>>}
 */
export const LIMITS = Object.freeze({
  /** Maximum assessment history entries */
  MAX_HISTORY_ENTRIES: 50,
  /** Maximum pledge entries */
  MAX_PLEDGE_ENTRIES: 100,
  /** Debounce delay for form input (ms) */
  DEBOUNCE_MS: 150,
  /** Toast notification display duration (ms) */
  TOAST_DURATION_MS: 3500,
  /** Maximum text input length */
  MAX_TEXT_LENGTH: 200,
  /** Maximum household size */
  MAX_HOUSEHOLD: 20,
  /** Maximum flights per month */
  MAX_FLIGHTS: 30,
  /** Maximum meals per month */
  MAX_MEALS: 120,
});

// ─── Google URLs Base ───────────────────────────────────────────────────────────

/**
 * Base URLs for Google service integrations.
 * @type {Readonly<Record<string, string>>}
 */
export const GOOGLE_BASE_URLS = Object.freeze({
  MAPS: 'https://www.google.com/maps/dir/',
  CALENDAR: 'https://calendar.google.com/calendar/render',
  GMAIL: 'https://mail.google.com/mail/',
  SEARCH: 'https://www.google.com/search',
  SHOPPING: 'https://www.google.com/shopping',
  EARTH: 'https://earth.google.com/web/',
  TRENDS: 'https://trends.google.com/trends/explore',
  SCHOLAR: 'https://scholar.google.com/scholar',
  YOUTUBE: 'https://www.youtube.com/results',
  DOCS: 'https://docs.google.com/document/u/0/create',
  FORMS: 'https://docs.google.com/forms/u/0/create',
  KEEP: 'https://keep.google.com/',
});
