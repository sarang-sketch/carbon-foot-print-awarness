/**
 * @fileoverview Storage abstraction layer for Carbon Compass.
 *
 * Provides a safe, testable interface over localStorage with:
 * - Graceful error handling (private browsing, quota exceeded)
 * - Type-safe serialization / deserialization
 * - Size limit enforcement
 * - Migration support for schema changes
 *
 * @module storage
 * @license MIT
 */

import { STORAGE_KEYS, LIMITS } from './config.js';
import { sanitizeHtml } from './security.js';

// ─── Constants ──────────────────────────────────────────────────────────────────

/** @type {number} Threshold for detecting improvement (5% decrease). */
const TREND_IMPROVE_FACTOR = 0.95;

/** @type {number} Threshold for detecting increase (5% increase). */
const TREND_INCREASE_FACTOR = 1.05;

// ─── Core Storage Operations ────────────────────────────────────────────────────

/**
 * Safely read a JSON value from localStorage.
 *
 * @template T
 * @param {string} key - Storage key.
 * @param {T} defaultValue - Fallback if key is missing or corrupt.
 * @returns {T} Parsed value or default.
 */
export function readStorage(key, defaultValue) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

/**
 * Safely write a JSON value to localStorage.
 *
 * @param {string} key - Storage key.
 * @param {*} value - Value to serialize and store.
 * @returns {boolean} True if write succeeded.
 */
export function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // QuotaExceededError or SecurityError (private browsing)
    return false;
  }
}

/**
 * Remove a key from localStorage.
 *
 * @param {string} key - Storage key.
 * @returns {boolean} True if removal succeeded.
 */
export function removeStorage(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if localStorage is available and writable.
 *
 * @returns {boolean} True if storage is functional.
 */
export function isStorageAvailable() {
  const testKey = '__carbon_compass_test__';
  try {
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

// ─── Pledge Operations ──────────────────────────────────────────────────────────

/**
 * @typedef {Object} Pledge
 * @property {string} id - Unique pledge identifier.
 * @property {string} text - Pledge text content (sanitized).
 * @property {boolean} completed - Completion status.
 * @property {string} createdAt - ISO timestamp.
 */

/**
 * Generate a unique pledge ID.
 * @returns {string}
 */
function generatePledgeId() {
  return `pledge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Load all pledges from storage.
 * @returns {Pledge[]}
 */
export function loadPledges() {
  return readStorage(STORAGE_KEYS.PLEDGES, []);
}

/**
 * Save pledges array to storage.
 * @param {Pledge[]} pledges - Array of pledge objects.
 * @returns {boolean} True if save succeeded.
 */
export function savePledges(pledges) {
  return writeStorage(STORAGE_KEYS.PLEDGES, pledges);
}

/**
 * Add a new pledge.
 *
 * @param {string} text - Pledge text (will be sanitized).
 * @returns {{ success: boolean, pledge: Pledge|null, error: string|null }}
 */
export function addPledge(text) {
  const sanitized = sanitizeHtml(text);

  if (!sanitized || sanitized.length === 0) {
    return { success: false, pledge: null, error: 'Pledge text is required' };
  }

  if (sanitized.length > LIMITS.MAX_TEXT_LENGTH) {
    return { success: false, pledge: null, error: `Pledge must be under ${LIMITS.MAX_TEXT_LENGTH} characters` };
  }

  const pledges = loadPledges();

  if (pledges.length >= LIMITS.MAX_PLEDGE_ENTRIES) {
    return { success: false, pledge: null, error: 'Maximum pledge limit reached' };
  }

  /** @type {Pledge} */
  const pledge = {
    id: generatePledgeId(),
    text: sanitized,
    completed: false,
    createdAt: new Date().toISOString(),
  };

  pledges.unshift(pledge);
  const saved = savePledges(pledges);

  return saved
    ? { success: true, pledge, error: null }
    : { success: false, pledge: null, error: 'Storage unavailable' };
}

/**
 * Toggle a pledge's completion status.
 *
 * @param {string} id - Pledge ID.
 * @returns {{ success: boolean, pledges: Pledge[] }}
 */
export function togglePledge(id) {
  const pledges = loadPledges();
  const pledge = pledges.find((p) => p.id === id);

  if (pledge) {
    pledge.completed = !pledge.completed;
    savePledges(pledges);
  }

  return { success: Boolean(pledge), pledges };
}

/**
 * Delete a pledge by ID.
 *
 * @param {string} id - Pledge ID.
 * @returns {{ success: boolean, pledges: Pledge[] }}
 */
export function deletePledge(id) {
  const before = loadPledges();
  const after = before.filter((p) => p.id !== id);
  savePledges(after);

  return { success: before.length !== after.length, pledges: after };
}

/**
 * Get pledge statistics.
 *
 * @returns {{ total: number, completed: number, pending: number, completionRate: number }}
 */
export function getPledgeStats() {
  const pledges = loadPledges();
  const completed = pledges.filter((p) => p.completed).length;
  const total = pledges.length;

  return {
    total,
    completed,
    pending: total - completed,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

// ─── History Operations ─────────────────────────────────────────────────────────

/**
 * @typedef {Object} HistoryEntry
 * @property {string} timestamp - ISO timestamp.
 * @property {Object} footprint - Calculated footprint data.
 * @property {Object} score - Classification score.
 * @property {Object} profile - User profile data.
 */

/**
 * Load assessment history.
 * @returns {HistoryEntry[]}
 */
export function loadHistory() {
  return readStorage(STORAGE_KEYS.HISTORY, []);
}

/**
 * Save an assessment to history.
 * Enforces maximum entry limit.
 *
 * @param {Object} assessment - Assessment data to save.
 * @returns {boolean} True if save succeeded.
 */
export function saveToHistory(assessment) {
  const history = loadHistory();

  history.unshift({
    ...assessment,
    timestamp: new Date().toISOString(),
  });

  // Enforce limit
  if (history.length > LIMITS.MAX_HISTORY_ENTRIES) {
    history.length = LIMITS.MAX_HISTORY_ENTRIES;
  }

  return writeStorage(STORAGE_KEYS.HISTORY, history);
}

/**
 * Clear all assessment history.
 * @returns {boolean} True if clear succeeded.
 */
export function clearHistory() {
  return removeStorage(STORAGE_KEYS.HISTORY);
}

/**
 * Get history statistics.
 *
 * @returns {{ totalAssessments: number, averageKg: number, trend: string, firstDate: string|null, lastDate: string|null }}
 */
export function getHistoryStats() {
  const history = loadHistory();

  if (history.length === 0) {
    return {
      totalAssessments: 0,
      averageKg: 0,
      trend: 'none',
      firstDate: null,
      lastDate: null,
    };
  }

  const totals = history
    .map((entry) => entry.footprint?.totalKg ?? 0)
    .filter((kg) => kg > 0);

  const averageKg = totals.length > 0
    ? Math.round((totals.reduce((sum, kg) => sum + kg, 0) / totals.length) * 10) / 10
    : 0;

  // Trend: compare first (oldest) and last (newest) entries
  let trend = 'stable';
  if (totals.length >= 2) {
    const newest = totals[0];
    const oldest = totals[totals.length - 1];
    if (newest < oldest * TREND_IMPROVE_FACTOR) trend = 'improving';
    else if (newest > oldest * TREND_INCREASE_FACTOR) trend = 'increasing';
  }

  return {
    totalAssessments: history.length,
    averageKg,
    trend,
    firstDate: history[history.length - 1]?.timestamp ?? null,
    lastDate: history[0]?.timestamp ?? null,
  };
}

// ─── Preferences ────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} UserPreferences
 * @property {string} theme - 'dark' or 'light'.
 * @property {boolean} animations - Enable/disable animations.
 * @property {string} units - 'metric' or 'imperial'.
 */

/** @type {UserPreferences} */
const DEFAULT_PREFERENCES = Object.freeze({
  theme: 'dark',
  animations: true,
  units: 'metric',
});

/**
 * Load user preferences.
 * @returns {UserPreferences}
 */
export function loadPreferences() {
  return { ...DEFAULT_PREFERENCES, ...readStorage(STORAGE_KEYS.PREFERENCES, {}) };
}

/**
 * Save user preferences.
 *
 * @param {Partial<UserPreferences>} updates - Preferences to update.
 * @returns {boolean} True if save succeeded.
 */
export function savePreferences(updates) {
  const current = loadPreferences();
  return writeStorage(STORAGE_KEYS.PREFERENCES, { ...current, ...updates });
}
