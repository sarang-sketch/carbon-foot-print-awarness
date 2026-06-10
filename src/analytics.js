/**
 * @fileoverview Analytics and reporting module for Carbon Compass.
 *
 * Provides pure functions for data aggregation, trend analysis,
 * and report generation from assessment history.
 * No external analytics services are used — all processing is local.
 *
 * @module analytics
 * @license MIT
 */

import { COMPARISON_CONSTANTS, CATEGORY_LABELS } from './config.js';

// ─── Data Aggregation ───────────────────────────────────────────────────────────

/**
 * Calculate the average of an array of numbers.
 *
 * @param {number[]} values - Numeric values.
 * @returns {number} Average, rounded to 1 decimal place. Returns 0 for empty arrays.
 */
export function average(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + (Number(val) || 0), 0);
  return Math.round((sum / values.length) * 10) / 10;
}

/**
 * Calculate the median of an array of numbers.
 *
 * @param {number[]} values - Numeric values.
 * @returns {number} Median value.
 */
export function median(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10
    : sorted[mid];
}

/**
 * Calculate min and max from an array of numbers.
 *
 * @param {number[]} values - Numeric values.
 * @returns {{ min: number, max: number }}
 */
export function minMax(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return { min: 0, max: 0 };
  }
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

/**
 * Calculate the standard deviation of an array of numbers.
 *
 * @param {number[]} values - Numeric values.
 * @returns {number} Standard deviation, rounded to 1 decimal.
 */
export function standardDeviation(values) {
  if (!Array.isArray(values) || values.length < 2) return 0;
  const avg = average(values);
  const squaredDiffs = values.map((v) => Math.pow((Number(v) || 0) - avg, 2));
  const avgSquaredDiff = squaredDiffs.reduce((sum, d) => sum + d, 0) / values.length;
  return Math.round(Math.sqrt(avgSquaredDiff) * 10) / 10;
}

// ─── Trend Analysis ─────────────────────────────────────────────────────────────

/**
 * Determine the trend direction from a series of values.
 * Uses simple linear regression to identify the direction.
 *
 * @param {number[]} values - Time-ordered values (oldest first).
 * @returns {{ direction: 'improving'|'increasing'|'stable', slope: number, confidence: string }}
 */
export function analyzeTrend(values) {
  if (!Array.isArray(values) || values.length < 2) {
    return { direction: 'stable', slope: 0, confidence: 'low' };
  }

  // Simple linear regression
  const n = values.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const roundedSlope = Math.round(slope * 100) / 100;

  // Determine direction with thresholds
  const threshold = average(values) * 0.02; // 2% of average
  let direction = 'stable';
  if (roundedSlope < -threshold) direction = 'improving';
  else if (roundedSlope > threshold) direction = 'increasing';

  // Confidence based on data points
  const confidence = n >= 10 ? 'high' : n >= 5 ? 'medium' : 'low';

  return { direction, slope: roundedSlope, confidence };
}

/**
 * Calculate percentage change between two values.
 *
 * @param {number} oldValue - Previous value.
 * @param {number} newValue - Current value.
 * @returns {number} Percentage change (positive = increase, negative = decrease).
 */
export function percentageChange(oldValue, newValue) {
  if (oldValue === 0) return newValue === 0 ? 0 : 100;
  return Math.round(((newValue - oldValue) / Math.abs(oldValue)) * 100 * 10) / 10;
}

// ─── Category Analysis ──────────────────────────────────────────────────────────

/**
 * Analyze category breakdown data across multiple assessments.
 *
 * @param {Array<Record<string, number>>} breakdowns - Array of breakdown objects.
 * @returns {Record<string, { average: number, trend: string, label: string }>}
 */
export function analyzeCategories(breakdowns) {
  if (!Array.isArray(breakdowns) || breakdowns.length === 0) return {};

  const categories = ['home', 'transport', 'food', 'consumption'];
  const result = {};

  for (const category of categories) {
    const values = breakdowns.map((b) => b[category] || 0);
    const trend = analyzeTrend(values);

    result[category] = {
      average: average(values),
      trend: trend.direction,
      label: CATEGORY_LABELS[category] || category,
    };
  }

  return result;
}

// ─── Comparison Calculations ────────────────────────────────────────────────────

/**
 * Convert monthly CO₂e to tangible real-world equivalents.
 *
 * @param {number} monthlyKg - Monthly CO₂e in kg.
 * @returns {Record<string, { value: number|string, label: string, icon: string }>}
 */
export function buildEquivalents(monthlyKg) {
  const yearlyKg = monthlyKg * COMPARISON_CONSTANTS.MONTHS_PER_YEAR;

  return {
    trees: {
      value: Math.ceil(yearlyKg / COMPARISON_CONSTANTS.TREE_ABSORPTION_KG_YEAR),
      label: 'Trees needed to offset (yearly)',
      icon: '🌳',
    },
    carKm: {
      value: Math.round(monthlyKg / 0.62),
      label: 'Equivalent car km/month',
      icon: '🚗',
    },
    flights: {
      value: Math.round((monthlyKg / 39) * 10) / 10,
      label: 'Short flights equivalent',
      icon: '✈️',
    },
    globalAverage: {
      value: `${Math.round((monthlyKg / COMPARISON_CONSTANTS.GLOBAL_AVERAGE_MONTHLY_KG) * 100)}%`,
      label: 'vs. global average',
      icon: '🌍',
    },
    lightbulbHours: {
      value: Math.round(monthlyKg / COMPARISON_CONSTANTS.LIGHTBULB_CO2E_PER_KWH),
      label: 'Lightbulb-hours equivalent',
      icon: '💡',
    },
    burgers: {
      value: Math.round(monthlyKg / COMPARISON_CONSTANTS.BURGER_CO2E_KG),
      label: 'Beef burgers equivalent',
      icon: '🍔',
    },
    smartphones: {
      value: Math.round(monthlyKg / 0.008),
      label: 'Full smartphone charges',
      icon: '📱',
    },
    showers: {
      value: Math.round(monthlyKg / 0.5),
      label: '8-min hot showers',
      icon: '🚿',
    },
  };
}

// ─── Report Generation ──────────────────────────────────────────────────────────

/**
 * Generate a comprehensive text report from assessment data.
 * Suitable for export, sharing, or Gemini AI context.
 *
 * @param {Object} assessment - Current assessment data.
 * @param {Object[]} [history=[]] - Previous assessments for trend analysis.
 * @returns {string} Formatted text report.
 */
export function generateReport(assessment, history = []) {
  const { footprint = {}, score = {}, profile = {} } = assessment;
  const breakdown = footprint.breakdown || {};
  const equivalents = buildEquivalents(footprint.totalKg || 0);

  const lines = [
    '═══════════════════════════════════════════',
    '  CARBON COMPASS — FOOTPRINT REPORT',
    '═══════════════════════════════════════════',
    '',
    `Date: ${new Date().toLocaleDateString('en-US', { dateStyle: 'full' })}`,
    `Total: ${footprint.totalKg || 0} kg CO₂e/month`,
    `Rank: ${score.rank || 'N/A'} (${score.color || 'N/A'})`,
    `Per Capita: ${footprint.perCapita || 'N/A'} kg/month`,
    '',
    '── Category Breakdown ──',
    ...Object.entries(breakdown).map(
      ([cat, kg]) => `  ${(CATEGORY_LABELS[cat] || cat).padEnd(24)} ${String(kg).padStart(8)} kg`,
    ),
    '',
    '── Equivalents ──',
    ...Object.values(equivalents).map(
      (eq) => `  ${eq.icon} ${String(eq.value).padStart(8)} ${eq.label}`,
    ),
    '',
    '── Profile ──',
    `  Household: ${profile.household || 'N/A'}`,
    `  Commute: ${profile.commuteMode || 'N/A'}`,
    `  Goal: ${profile.goal || 'N/A'}`,
  ];

  // Add trend data if history is available
  if (history.length >= 2) {
    const totals = history.map((h) => h.footprint?.totalKg || 0).reverse();
    const trend = analyzeTrend(totals);

    lines.push(
      '',
      '── Trend Analysis ──',
      `  Direction: ${trend.direction}`,
      `  Assessments: ${history.length}`,
      `  Confidence: ${trend.confidence}`,
    );
  }

  lines.push('', '═══════════════════════════════════════════');
  lines.push('Generated by Carbon Compass');

  return lines.join('\n');
}

/**
 * Generate a summary for the current assessment.
 *
 * @param {Object} assessment - Assessment data.
 * @returns {{ summary: string, highlights: string[], topAction: string }}
 */
export function generateSummary(assessment) {
  const { footprint = {}, score = {}, plan = [] } = assessment;
  const breakdown = footprint.breakdown || {};
  const topCat = Object.entries(breakdown).sort((a, b) => b[1] - a[1])[0];

  const highlights = [];

  if (footprint.totalKg <= 350) {
    highlights.push('🌿 Your footprint is below the global average — excellent!');
  }
  if (breakdown.transport > breakdown.home) {
    highlights.push('🚗 Transport is your biggest category — consider alternatives');
  }
  if (breakdown.food > 100) {
    highlights.push('🥩 Food emissions are high — try more plant-based meals');
  }

  return {
    summary: `Your monthly footprint is ${footprint.totalKg || 0} kg CO₂e (${score.rank || 'N/A'}). Top category: ${topCat?.[0] || 'N/A'} at ${topCat?.[1] || 0} kg.`,
    highlights,
    topAction: plan[0]?.title || 'Review your footprint categories',
  };
}
