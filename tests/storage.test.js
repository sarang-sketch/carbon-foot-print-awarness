/**
 * @fileoverview Storage module — Comprehensive Test Suite
 *
 * Tests cover: core CRUD operations, pledge management, history tracking,
 * preferences, edge cases, error handling, and limit enforcement.
 *
 * Run with: node --test tests/storage.test.js
 *
 * @module tests/storage
 * @license MIT
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readStorage,
  writeStorage,
  removeStorage,
  isStorageAvailable,
  loadPledges,
  savePledges,
  addPledge,
  togglePledge,
  deletePledge,
  getPledgeStats,
  loadHistory,
  saveToHistory,
  clearHistory,
  getHistoryStats,
  loadPreferences,
  savePreferences,
} from '../src/storage.js';

// ─── Mock localStorage ──────────────────────────────────────────────────────────

/** @type {Map<string, string>} */
const store = new Map();

globalThis.localStorage = {
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear(),
  get length() { return store.size; },
  key: (index) => [...store.keys()][index] ?? null,
};

// Clear store between tests
test.beforeEach(() => store.clear());

// ─── Core Storage Operations ────────────────────────────────────────────────────

test('readStorage returns default when key does not exist', () => {
  assert.deepEqual(readStorage('nonexistent', []), []);
  assert.equal(readStorage('nonexistent', 42), 42);
  assert.equal(readStorage('nonexistent', 'fallback'), 'fallback');
});

test('writeStorage and readStorage round-trip correctly', () => {
  const data = { foo: 'bar', count: 42 };
  const success = writeStorage('test-key', data);
  assert.equal(success, true);
  assert.deepEqual(readStorage('test-key', null), data);
});

test('writeStorage handles arrays', () => {
  writeStorage('arr', [1, 2, 3]);
  assert.deepEqual(readStorage('arr', []), [1, 2, 3]);
});

test('removeStorage deletes a key', () => {
  writeStorage('to-delete', 'value');
  assert.equal(readStorage('to-delete', null), 'value');
  const success = removeStorage('to-delete');
  assert.equal(success, true);
  assert.equal(readStorage('to-delete', null), null);
});

test('removeStorage returns true for nonexistent key', () => {
  assert.equal(removeStorage('does-not-exist'), true);
});

test('isStorageAvailable returns true with working localStorage', () => {
  assert.equal(isStorageAvailable(), true);
});

test('readStorage returns default for corrupt JSON', () => {
  store.set('corrupt', '{invalid json');
  assert.deepEqual(readStorage('corrupt', []), []);
});

// ─── Pledge Operations ──────────────────────────────────────────────────────────

test('loadPledges returns empty array initially', () => {
  assert.deepEqual(loadPledges(), []);
});

test('addPledge creates a pledge with correct structure', () => {
  const result = addPledge('Reduce meat consumption');
  assert.equal(result.success, true);
  assert.equal(result.pledge.text, 'Reduce meat consumption');
  assert.equal(result.pledge.completed, false);
  assert.ok(result.pledge.id.startsWith('pledge-'));
  assert.ok(result.pledge.createdAt);
});

test('addPledge sanitizes HTML in pledge text', () => {
  const result = addPledge('<script>alert("xss")</script>Walk more');
  assert.equal(result.success, true);
  assert.ok(!result.pledge.text.includes('<script>'));
  assert.ok(result.pledge.text.includes('Walk more'));
});

test('addPledge rejects empty text', () => {
  const result = addPledge('');
  assert.equal(result.success, false);
  assert.equal(result.pledge, null);
  assert.ok(result.error.includes('required'));
});

test('addPledge rejects whitespace-only text', () => {
  const result = addPledge('   ');
  assert.equal(result.success, false);
});

test('togglePledge flips completion status', () => {
  const { pledge } = addPledge('Test pledge');
  assert.equal(pledge.completed, false);

  const result = togglePledge(pledge.id);
  assert.equal(result.success, true);
  const toggled = result.pledges.find((p) => p.id === pledge.id);
  assert.equal(toggled.completed, true);
});

test('togglePledge handles nonexistent ID gracefully', () => {
  const result = togglePledge('nonexistent-id');
  assert.equal(result.success, false);
});

test('deletePledge removes the pledge', () => {
  const { pledge } = addPledge('To be deleted');
  const result = deletePledge(pledge.id);
  assert.equal(result.success, true);
  assert.ok(!result.pledges.some((p) => p.id === pledge.id));
});

test('deletePledge returns success false for nonexistent ID', () => {
  const result = deletePledge('nonexistent');
  assert.equal(result.success, false);
});

test('getPledgeStats calculates correct statistics', () => {
  addPledge('Pledge A');
  const { pledge } = addPledge('Pledge B');
  togglePledge(pledge.id);

  const stats = getPledgeStats();
  assert.equal(stats.total, 2);
  assert.equal(stats.completed, 1);
  assert.equal(stats.pending, 1);
  assert.equal(stats.completionRate, 50);
});

test('getPledgeStats returns zeros when empty', () => {
  const stats = getPledgeStats();
  assert.equal(stats.total, 0);
  assert.equal(stats.completed, 0);
  assert.equal(stats.completionRate, 0);
});

test('savePledges and loadPledges round-trip correctly', () => {
  const pledges = [
    { id: 'p1', text: 'Test', completed: false, createdAt: new Date().toISOString() },
  ];
  savePledges(pledges);
  assert.deepEqual(loadPledges(), pledges);
});

// ─── History Operations ─────────────────────────────────────────────────────────

test('loadHistory returns empty array initially', () => {
  assert.deepEqual(loadHistory(), []);
});

test('saveToHistory adds an entry with timestamp', () => {
  const assessment = { footprint: { totalKg: 500 }, score: { rank: 'Climber' } };
  saveToHistory(assessment);
  const history = loadHistory();
  assert.equal(history.length, 1);
  assert.equal(history[0].footprint.totalKg, 500);
  assert.ok(history[0].timestamp);
});

test('saveToHistory prepends newest entries', () => {
  saveToHistory({ footprint: { totalKg: 100 } });
  saveToHistory({ footprint: { totalKg: 200 } });
  const history = loadHistory();
  assert.equal(history[0].footprint.totalKg, 200);
  assert.equal(history[1].footprint.totalKg, 100);
});

test('saveToHistory enforces max entry limit', () => {
  for (let i = 0; i < 55; i++) {
    saveToHistory({ footprint: { totalKg: i } });
  }
  const history = loadHistory();
  assert.ok(history.length <= 50);
});

test('clearHistory removes all entries', () => {
  saveToHistory({ footprint: { totalKg: 42 } });
  clearHistory();
  assert.deepEqual(loadHistory(), []);
});

test('getHistoryStats returns correct statistics', () => {
  saveToHistory({ footprint: { totalKg: 300 } });
  saveToHistory({ footprint: { totalKg: 500 } });
  const stats = getHistoryStats();
  assert.equal(stats.totalAssessments, 2);
  assert.equal(stats.averageKg, 400);
  assert.ok(stats.firstDate);
  assert.ok(stats.lastDate);
});

test('getHistoryStats returns zeros for empty history', () => {
  const stats = getHistoryStats();
  assert.equal(stats.totalAssessments, 0);
  assert.equal(stats.averageKg, 0);
  assert.equal(stats.trend, 'none');
  assert.equal(stats.firstDate, null);
});

test('getHistoryStats detects improving trend', () => {
  saveToHistory({ footprint: { totalKg: 800 } }); // oldest (pushed to end)
  saveToHistory({ footprint: { totalKg: 300 } }); // newest (at front)
  const stats = getHistoryStats();
  assert.equal(stats.trend, 'improving');
});

test('getHistoryStats detects increasing trend', () => {
  saveToHistory({ footprint: { totalKg: 300 } }); // oldest
  saveToHistory({ footprint: { totalKg: 800 } }); // newest
  const stats = getHistoryStats();
  assert.equal(stats.trend, 'increasing');
});

// ─── Preferences ────────────────────────────────────────────────────────────────

test('loadPreferences returns defaults when empty', () => {
  const prefs = loadPreferences();
  assert.equal(prefs.theme, 'dark');
  assert.equal(prefs.animations, true);
  assert.equal(prefs.units, 'metric');
});

test('savePreferences merges with existing preferences', () => {
  savePreferences({ theme: 'light' });
  const prefs = loadPreferences();
  assert.equal(prefs.theme, 'light');
  assert.equal(prefs.animations, true); // unchanged
});

test('savePreferences overwrites specific keys only', () => {
  savePreferences({ theme: 'light', units: 'imperial' });
  savePreferences({ theme: 'dark' });
  const prefs = loadPreferences();
  assert.equal(prefs.theme, 'dark');
  assert.equal(prefs.units, 'imperial'); // retained from previous save
});
