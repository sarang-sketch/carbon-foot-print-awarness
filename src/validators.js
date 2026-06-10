/**
 * @fileoverview Input validation module for Carbon Compass.
 *
 * Provides pure, testable validation functions for all user inputs.
 * Each validator returns a result object with `valid`, `value`, and `error` fields,
 * following the Result pattern for predictable error handling.
 *
 * @module validators
 * @license MIT
 */

import { LIMITS } from './config.js';

// ─── Result Builders ────────────────────────────────────────────────────────────

/**
 * Create a successful validation result.
 * @template T
 * @param {T} value - The validated and coerced value.
 * @returns {{ valid: true, value: T, error: null }}
 */
function ok(value) {
  return { valid: true, value, error: null };
}

/**
 * Create a failed validation result.
 * @param {string} error - Human-readable error description.
 * @returns {{ valid: false, value: null, error: string }}
 */
function fail(error) {
  return { valid: false, value: null, error };
}

// ─── Numeric Validators ─────────────────────────────────────────────────────────

/**
 * Validate and coerce a value to a non-negative finite number.
 * Returns 0 for invalid inputs instead of throwing.
 *
 * @param {*} value - Raw input value.
 * @param {string} [fieldName='value'] - Field name for error messages.
 * @param {Object} [options] - Validation options.
 * @param {number} [options.min=0] - Minimum allowed value.
 * @param {number} [options.max=Infinity] - Maximum allowed value.
 * @returns {{ valid: boolean, value: number, error: string|null }}
 */
export function validateNumber(value, fieldName = 'value', options = {}) {
  const { min = 0, max = Infinity } = options;
  const parsed = Number(value);

  if (value === null || value === undefined || value === '') {
    return ok(0);
  }

  if (!Number.isFinite(parsed)) {
    return fail(`${fieldName} must be a valid number`);
  }

  if (parsed < min) {
    return fail(`${fieldName} must be at least ${min}`);
  }

  if (parsed > max) {
    return fail(`${fieldName} must be at most ${max}`);
  }

  return ok(Math.max(0, parsed));
}

/**
 * Validate electricity input (kWh).
 * @param {*} value - Raw input value.
 * @returns {{ valid: boolean, value: number, error: string|null }}
 */
export function validateElectricity(value) {
  return validateNumber(value, 'Electricity (kWh)', { min: 0, max: 10000 });
}

/**
 * Validate natural gas input (therms).
 * @param {*} value - Raw input value.
 * @returns {{ valid: boolean, value: number, error: string|null }}
 */
export function validateGas(value) {
  return validateNumber(value, 'Natural gas (therms)', { min: 0, max: 5000 });
}

/**
 * Validate household size.
 * @param {*} value - Raw input value.
 * @returns {{ valid: boolean, value: number, error: string|null }}
 */
export function validateHousehold(value) {
  const result = validateNumber(value, 'Household size', {
    min: 1,
    max: LIMITS.MAX_HOUSEHOLD,
  });
  if (result.valid && result.value === 0) {
    return ok(1); // Default to 1 person
  }
  return result;
}

/**
 * Validate distance input (km).
 * @param {*} value - Raw input value.
 * @param {string} [fieldName='Distance'] - Field name.
 * @returns {{ valid: boolean, value: number, error: string|null }}
 */
export function validateDistance(value, fieldName = 'Distance') {
  return validateNumber(value, `${fieldName} (km)`, { min: 0, max: 100000 });
}

/**
 * Validate flight count.
 * @param {*} value - Raw input value.
 * @param {string} [fieldName='Flights'] - Field name.
 * @returns {{ valid: boolean, value: number, error: string|null }}
 */
export function validateFlights(value, fieldName = 'Flights') {
  return validateNumber(value, fieldName, { min: 0, max: LIMITS.MAX_FLIGHTS });
}

/**
 * Validate meal count.
 * @param {*} value - Raw input value.
 * @param {string} [fieldName='Meals'] - Field name.
 * @returns {{ valid: boolean, value: number, error: string|null }}
 */
export function validateMeals(value, fieldName = 'Meals') {
  return validateNumber(value, fieldName, { min: 0, max: LIMITS.MAX_MEALS });
}

/**
 * Validate spending amount.
 * @param {*} value - Raw input value.
 * @returns {{ valid: boolean, value: number, error: string|null }}
 */
export function validateSpending(value) {
  return validateNumber(value, 'Spending ($)', { min: 0, max: 100000 });
}

// ─── Text Validators ────────────────────────────────────────────────────────────

/**
 * Validate a text input string.
 *
 * @param {*} value - Raw input value.
 * @param {string} [fieldName='Text'] - Field name for error messages.
 * @param {Object} [options] - Validation options.
 * @param {number} [options.maxLength=200] - Maximum string length.
 * @param {boolean} [options.required=false] - Whether the field is required.
 * @returns {{ valid: boolean, value: string, error: string|null }}
 */
export function validateText(value, fieldName = 'Text', options = {}) {
  const { maxLength = LIMITS.MAX_TEXT_LENGTH, required = false } = options;
  const text = String(value ?? '').trim();

  if (required && text.length === 0) {
    return fail(`${fieldName} is required`);
  }

  if (text.length > maxLength) {
    return fail(`${fieldName} must be at most ${maxLength} characters`);
  }

  return ok(text);
}

/**
 * Validate a commute mode selection.
 * @param {*} value - Raw input value.
 * @returns {{ valid: boolean, value: string, error: string|null }}
 */
export function validateCommuteMode(value) {
  const VALID_MODES = [
    'car', 'bus', 'bike', 'walk', 'train',
    'electric car', 'carpool', 'remote',
  ];
  const text = String(value ?? 'car').toLowerCase().trim();

  if (!VALID_MODES.includes(text)) {
    return ok('car'); // Default to car
  }

  return ok(text);
}

/**
 * Validate a sustainability goal selection.
 * @param {*} value - Raw input value.
 * @returns {{ valid: boolean, value: string, error: string|null }}
 */
export function validateGoal(value) {
  const VALID_GOALS = [
    'save money', 'reduce emissions', 'health',
    'teach family', 'net zero',
  ];
  const text = String(value ?? 'save money').toLowerCase().trim();

  if (!VALID_GOALS.includes(text)) {
    return ok('save money'); // Default
  }

  return ok(text);
}

// ─── Compound Validator ─────────────────────────────────────────────────────────

/**
 * Validate an entire form input object.
 * Returns coerced values and any validation errors.
 *
 * @param {Object} input - Raw form data.
 * @returns {{ valid: boolean, values: Object, errors: string[] }}
 */
export function validateFormInput(input = {}) {
  const errors = [];
  const values = {};

  const validations = [
    ['electricityKwh', validateElectricity(input.electricityKwh)],
    ['gasTherms', validateGas(input.gasTherms)],
    ['household', validateHousehold(input.household)],
    ['carKm', validateDistance(input.carKm, 'Car travel')],
    ['transitKm', validateDistance(input.transitKm, 'Transit travel')],
    ['flightsShort', validateFlights(input.flightsShort, 'Short flights')],
    ['flightsLong', validateFlights(input.flightsLong, 'Long flights')],
    ['meatMeals', validateMeals(input.meatMeals, 'Meat meals')],
    ['dairyMeals', validateMeals(input.dairyMeals, 'Dairy meals')],
    ['shoppingSpend', validateSpending(input.shoppingSpend)],
    ['commuteMode', validateCommuteMode(input.commuteMode)],
    ['goal', validateGoal(input.goal)],
  ];

  for (const [field, result] of validations) {
    if (result.valid) {
      values[field] = result.value;
    } else {
      errors.push(result.error);
      values[field] = 0; // Safe default
    }
  }

  return {
    valid: errors.length === 0,
    values,
    errors,
  };
}
