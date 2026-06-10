/**
 * @fileoverview Test suite for input validators.
 *
 * Tests all validator functions including numeric validation,
 * text validation, commute mode/goal selection, and the
 * compound form validator.
 *
 * @module tests/validators.test
 * @license MIT
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateNumber,
  validateElectricity,
  validateGas,
  validateHousehold,
  validateDistance,
  validateFlights,
  validateMeals,
  validateSpending,
  validateText,
  validateCommuteMode,
  validateGoal,
  validateFormInput,
} from '../src/validators.js';

// ─── validateNumber ─────────────────────────────────────────────────────────────

test('validateNumber accepts valid positive numbers', () => {
  const result = validateNumber(42);
  assert.equal(result.valid, true);
  assert.equal(result.value, 42);
  assert.equal(result.error, null);
});

test('validateNumber accepts zero', () => {
  const result = validateNumber(0);
  assert.equal(result.valid, true);
  assert.equal(result.value, 0);
});

test('validateNumber accepts string numbers', () => {
  const result = validateNumber('150');
  assert.equal(result.valid, true);
  assert.equal(result.value, 150);
});

test('validateNumber returns 0 for empty values', () => {
  assert.equal(validateNumber('').value, 0);
  assert.equal(validateNumber(null).value, 0);
  assert.equal(validateNumber(undefined).value, 0);
});

test('validateNumber fails for non-numeric strings', () => {
  const result = validateNumber('abc', 'Test');
  assert.equal(result.valid, false);
  assert.match(result.error, /valid number/i);
});

test('validateNumber fails for NaN and Infinity', () => {
  assert.equal(validateNumber(NaN, 'Test').valid, false);
  assert.equal(validateNumber(Infinity, 'Test').valid, false);
});

test('validateNumber enforces min constraint', () => {
  const result = validateNumber(-5, 'Test', { min: 0 });
  assert.equal(result.valid, false);
  assert.match(result.error, /at least 0/);
});

test('validateNumber enforces max constraint', () => {
  const result = validateNumber(999, 'Test', { min: 0, max: 100 });
  assert.equal(result.valid, false);
  assert.match(result.error, /at most 100/);
});

// ─── Specific Validators ────────────────────────────────────────────────────────

test('validateElectricity accepts valid kWh values', () => {
  assert.equal(validateElectricity(120).valid, true);
  assert.equal(validateElectricity(0).valid, true);
  assert.equal(validateElectricity(10000).valid, true);
});

test('validateElectricity rejects out-of-range values', () => {
  assert.equal(validateElectricity(20000).valid, false);
});

test('validateGas accepts valid therm values', () => {
  assert.equal(validateGas(10).valid, true);
  assert.equal(validateGas(0).valid, true);
});

test('validateHousehold enforces min of 1', () => {
  // 0 is below min=1, so it fails validation
  const result = validateHousehold(0);
  assert.equal(result.valid, false);
});

test('validateHousehold enforces max of 20', () => {
  assert.equal(validateHousehold(21).valid, false);
});

test('validateDistance accepts valid km values', () => {
  assert.equal(validateDistance(300).valid, true);
  assert.equal(validateDistance(0).valid, true);
});

test('validateFlights enforces max of 30', () => {
  assert.equal(validateFlights(30).valid, true);
  assert.equal(validateFlights(31).valid, false);
});

test('validateMeals enforces max of 120', () => {
  assert.equal(validateMeals(120).valid, true);
  assert.equal(validateMeals(121).valid, false);
});

test('validateSpending accepts valid dollar amounts', () => {
  assert.equal(validateSpending(150).valid, true);
  assert.equal(validateSpending(0).valid, true);
});

// ─── Text Validators ────────────────────────────────────────────────────────────

test('validateText accepts normal text', () => {
  const result = validateText('Hello world');
  assert.equal(result.valid, true);
  assert.equal(result.value, 'Hello world');
});

test('validateText trims whitespace', () => {
  assert.equal(validateText('  trimmed  ').value, 'trimmed');
});

test('validateText enforces maxLength', () => {
  const longText = 'a'.repeat(300);
  assert.equal(validateText(longText, 'Test', { maxLength: 200 }).valid, false);
});

test('validateText handles required field', () => {
  assert.equal(validateText('', 'Name', { required: true }).valid, false);
  assert.equal(validateText('Valid', 'Name', { required: true }).valid, true);
});

test('validateCommuteMode accepts valid modes', () => {
  assert.equal(validateCommuteMode('car').value, 'car');
  assert.equal(validateCommuteMode('bike').value, 'bike');
  assert.equal(validateCommuteMode('train').value, 'train');
  assert.equal(validateCommuteMode('remote').value, 'remote');
});

test('validateCommuteMode defaults for invalid input', () => {
  assert.equal(validateCommuteMode('helicopter').value, 'car');
  assert.equal(validateCommuteMode('').value, 'car');
});

test('validateGoal accepts valid goals', () => {
  assert.equal(validateGoal('save money').value, 'save money');
  assert.equal(validateGoal('net zero').value, 'net zero');
  assert.equal(validateGoal('health').value, 'health');
});

test('validateGoal defaults for invalid input', () => {
  assert.equal(validateGoal('invalid goal').value, 'save money');
});

// ─── Compound Form Validator ────────────────────────────────────────────────────

test('validateFormInput validates all fields', () => {
  const result = validateFormInput({
    electricityKwh: 120,
    gasTherms: 10,
    household: 3,
    carKm: 300,
    transitKm: 80,
    flightsShort: 1,
    flightsLong: 0,
    meatMeals: 10,
    dairyMeals: 12,
    shoppingSpend: 150,
    commuteMode: 'car',
    goal: 'save money',
  });

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.values.electricityKwh, 120);
  assert.equal(result.values.commuteMode, 'car');
  assert.equal(result.values.goal, 'save money');
});

test('validateFormInput handles empty input', () => {
  const result = validateFormInput({});
  assert.ok(result.values.household >= 0);
  assert.ok(result.values.electricityKwh >= 0);
});

test('validateFormInput collects errors for invalid fields', () => {
  const result = validateFormInput({
    electricityKwh: 'invalid',
    flightsShort: 999,
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 2);
});

test('validateFormInput returns safe defaults for invalid values', () => {
  const result = validateFormInput({
    electricityKwh: NaN,
    carKm: -100,
  });

  assert.equal(result.values.electricityKwh, 0);
  assert.equal(result.values.carKm, 0);
});
